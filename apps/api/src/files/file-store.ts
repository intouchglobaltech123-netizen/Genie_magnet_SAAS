import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Inject, Injectable } from "@nestjs/common";
import { ENV, type Env } from "../env.js";

/** Raised when an upload is larger than it said it would be, or than the limit. */
export class TooLargeError extends Error {}

/**
 * Where uploaded files live: a folder (on a server, a mounted volume), with each agency's files under its own
 * folder. Kept behind this small interface so a cloud bucket can take its place without touching the rest.
 */
@Injectable()
export class FileStore {
  private readonly root: string;
  private readonly secret: string;

  constructor(@Inject(ENV) env: Env) {
    this.root = resolve(env.FILES_DIR);
    // Production requires a real secret (env.ts); locally and in tests a fixed one is fine.
    this.secret = env.FILES_SECRET ?? env.BETTER_AUTH_SECRET ?? "local-development-files-secret-not-for-real-use";
  }

  private path(key: string) {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error("Invalid storage key");
    return p;
  }

  /** Writes the stream, stopping as soon as it passes `maxBytes`. Returns the bytes written. */
  async put(key: string, body: NodeJS.ReadableStream, maxBytes: number) {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    const partial = `${target}.part`;
    let bytes = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, done) {
        bytes += chunk.length;
        done(bytes > maxBytes ? new TooLargeError("The file is larger than expected") : null, chunk);
      },
    });
    try {
      await pipeline(body, counter, createWriteStream(partial));
      await rename(partial, target);
      return bytes;
    } catch (e) {
      await rm(partial, { force: true });
      throw e;
    }
  }

  async open(key: string) {
    const p = this.path(key);
    const { size } = await stat(p);
    return { stream: createReadStream(p), size };
  }

  async remove(key: string) {
    await rm(this.path(key), { force: true });
  }

  /** Everything under a folder — an agency's own, when its workspace is deleted (P6-10). */
  async removeFolder(prefix: string) {
    await rm(this.path(prefix), { recursive: true, force: true });
  }

  // ─── Signed links ─────────────────────────────────────────────────

  private sign(payload: string) {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  /** A link token for one file and one purpose, valid for `seconds`. */
  token(fileId: string, agencyId: string, purpose: "up" | "down", seconds: number) {
    const payload = Buffer.from(JSON.stringify({ f: fileId, a: agencyId, p: purpose, e: Math.floor(Date.now() / 1000) + seconds })).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  /** The file and agency a token is for, or null when it is forged, for another purpose, or expired. */
  verify(token: string, purpose: "up" | "down"): { fileId: string; agencyId: string } | null {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const v = JSON.parse(Buffer.from(payload, "base64url").toString()) as { f: string; a: string; p: string; e: number };
      if (v.p !== purpose || v.e < Date.now() / 1000) return null;
      return { fileId: v.f, agencyId: v.a };
    } catch {
      return null;
    }
  }
}
