import type { Request, Response } from "express";
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, PayloadTooLargeException } from "@nestjs/common";
import { allows, extOf, FILE_ENTITIES, type FileEntity, type FileStart } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { ENV, type Env } from "../env.js";
import { asLinkHolder, TenantDb } from "../tenancy/tenant-context.js";
import { FileStore, TooLargeError } from "./file-store.js";

const UPLOAD_SECONDS = 60 * 60;
const DOWNLOAD_SECONDS = 60 * 60;
/** Shown in the browser rather than downloaded. */
const INLINE = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime)|audio\/|application\/pdf)/;

export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: string;
  uploadedBy: string | null;
  createdAt: Date;
}

/**
 * File uploads (P1-05). An upload starts with a record (pending) and a signed upload link valid for an hour; the browser
 * sends the file straight to that link, and the record becomes ready. Downloads use signed links too, so a file is
 * never reachable by a guessable address. Who may upload, see or remove a file follows the area of the record it
 * belongs to (a client's files: Clients; a video's: Shoots and videos…).
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly store: FileStore,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private can(entity: FileEntity, level: "view" | "edit") {
    if (!allows(this.tenant.permissions, FILE_ENTITIES[entity], level))
      throw new ForbiddenException(level === "view" ? "Your role cannot see these files." : "Your role cannot add or remove these files.");
  }

  /** The record a file is attached to must exist in this agency. */
  private async exists(entity: FileEntity, entityId: string) {
    const db = this.tenant.db;
    const uuid = /^[0-9a-f-]{36}$/i.test(entityId);
    const found =
      entity === "agency"
        ? entityId === this.tenant.agencyId
        : !uuid
          ? false
          : entity === "client"
            ? !!(await db.client.findFirst({ where: { id: entityId }, select: { id: true } }))
            : entity === "onboarding"
              ? !!(await db.questionnaireResponse.findFirst({ where: { id: entityId }, select: { id: true } }))
              : entity === "video" || entity === "publishing"
                ? !!(await db.video.findFirst({ where: { id: entityId }, select: { id: true } }))
                : !!(await db.contentItem.findFirst({ where: { id: entityId }, select: { id: true } }));
    if (!found) throw new NotFoundException("The record these files belong to was not found.");
  }

  private present(f: { id: string; name: string; mime: string; size: bigint; status: string; uploadedBy: string | null; createdAt: Date }) {
    return {
      id: f.id,
      name: f.name,
      mime: f.mime,
      size: Number(f.size),
      status: f.status,
      uploadedBy: f.uploadedBy,
      createdAt: f.createdAt,
      url: f.status === "ready" ? `/api/files/download/${this.store.token(f.id, this.tenant.agencyId, "down", DOWNLOAD_SECONDS)}` : null,
    };
  }

  /** Starts an upload: the record, and the link to send the file to. Signed-in people and private links both use it. */
  private async begin(input: FileStart & { mime: string }, uploadedBy: string | null) {
    const max = this.env.FILE_MAX_MB * 1024 * 1024;
    if (input.size > max) throw new PayloadTooLargeException(`Files can be up to ${this.env.FILE_MAX_MB} MB.`);
    const agencyId = this.tenant.agencyId;
    const id = await this.tenant.tx(async (tx) => {
      const f = await tx.fileObject.create({
        data: {
          agencyId,
          storageKey: `pending-${crypto.randomUUID()}`,
          name: input.name,
          mime: input.mime || "application/octet-stream",
          size: BigInt(input.size),
          entity: input.entity,
          entityId: input.entityId,
          uploadedBy,
        },
      });
      // The agency's own folder, then what it belongs to.
      const ext = extOf(input.name);
      await tx.fileObject.update({ where: { id: f.id }, data: { storageKey: `${agencyId}/${input.entity}/${f.id}${ext ? `.${ext}` : ""}` } });
      return f.id;
    });
    // Straight to the API: large files never pass through the web app.
    return { id, uploadUrl: `${this.env.PUBLIC_API_URL}/files/upload/${this.store.token(id, agencyId, "up", UPLOAD_SECONDS)}`, expiresIn: UPLOAD_SECONDS };
  }

  async start(input: FileStart & { mime: string }) {
    this.can(input.entity, "edit");
    await this.exists(input.entity, input.entityId);
    return this.begin(input, this.tenant.userId ?? null);
  }

  /** A client uploading through their private onboarding link (inside the link's agency). */
  startForLink(responseId: string, input: Omit<FileStart, "entity" | "entityId"> & { mime: string }) {
    return this.begin({ ...input, entity: "onboarding", entityId: responseId }, null);
  }

  /** Receives the file sent to an upload link. */
  async receive(token: string, req: Request) {
    const t = this.store.verify(token, "up");
    if (!t) throw new ForbiddenException("This upload link is not valid any more — start the upload again.");
    return asLinkHolder(t.agencyId, async () => {
      const f = await this.tenant.db.fileObject.findFirst({ where: { id: t.fileId } });
      if (!f) throw new NotFoundException("The upload was cancelled.");
      if (f.status !== "pending") throw new ConflictException("This file is already uploaded.");
      let bytes: number;
      try {
        bytes = await this.store.put(f.storageKey, req, Number(f.size));
      } catch (e) {
        if (e instanceof TooLargeError) throw new PayloadTooLargeException("The file is larger than the upload said it would be.");
        throw e;
      }
      if (!bytes) throw new BadRequestException("The file arrived empty.");
      await this.tenant.tx(async (tx) => {
        const ready = await tx.fileObject.update({ where: { id: f.id }, data: { status: "ready", size: BigInt(bytes), uploadedAt: new Date() } });
        await this.audit.record(tx, {
          action: "upload",
          entity: "file",
          entityId: f.id,
          after: { name: ready.name, size: bytes, belongsTo: `${ready.entity}:${ready.entityId}`, by: f.uploadedBy ? "team" : "client link" },
        });
      });
      return this.present({ ...f, size: BigInt(bytes), status: "ready" });
    });
  }

  /** Sends a file for a download link. */
  async send(token: string, res: Response) {
    const t = this.store.verify(token, "down");
    if (!t) throw new ForbiddenException("This download link has expired — open the file again from the app.");
    const f = await asLinkHolder(t.agencyId, () => this.tenant.db.fileObject.findFirst({ where: { id: t.fileId, status: "ready" } }));
    if (!f) throw new NotFoundException("This file was removed.");
    const { stream, size } = await this.store.open(f.storageKey);
    const name = encodeURIComponent(f.name);
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Content-Length", String(size));
    res.setHeader("Content-Disposition", `${INLINE.test(f.mime) ? "inline" : "attachment"}; filename*=UTF-8''${name}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    stream.pipe(res);
  }

  async list(entity: FileEntity, entityId: string) {
    this.can(entity, "view");
    return this.listFor(entity, entityId);
  }

  /** Ready files of a record, newest first, each with a download link. */
  async listFor(entity: FileEntity, entityId: string) {
    const rows = await this.tenant.db.fileObject.findMany({ where: { entity, entityId, status: "ready" }, orderBy: { createdAt: "desc" }, take: 500 });
    return rows.map((r) => this.present(r));
  }

  async remove(id: string) {
    const f = await this.tenant.db.fileObject.findFirst({ where: { id } });
    if (!f) throw new NotFoundException("No file with that id.");
    this.can((f.entity ?? "agency") as FileEntity, "edit");
    await this.tenant.tx(async (tx) => {
      await tx.fileObject.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "file", entityId: id, before: { name: f.name, belongsTo: `${f.entity}:${f.entityId}` } });
    });
    await this.store.remove(f.storageKey);
  }
}
