"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Loader2, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ACCEPT, fileAllowed, fileSize, type UploadStart } from "@gm/shared";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { api, ApiError, errorMessage } from "./api";
import { fmtDate } from "./format";
import { useDeleteFile, useFiles } from "./queries";

/**
 * Uploads one file: `start` makes the record and returns a signed link; the file goes straight to that link, with
 * progress. Returns the new file's id.
 */
export function uploadFile(
  start: (meta: { name: string; mime: string; size: number }) => Promise<UploadStart>,
  file: File,
  onProgress?: (pct: number) => void,
) {
  if (!fileAllowed(file.name, file.type)) return Promise.reject(new Error(`${file.name}: this kind of file cannot be uploaded.`));
  return start({ name: file.name, mime: file.type, size: file.size }).then(
    (s) =>
      new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", s.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve(s.id);
          let message = `Upload failed (${xhr.status}).`;
          try {
            message = (JSON.parse(xhr.responseText) as { message?: string }).message ?? message;
          } catch {}
          reject(new ApiError(xhr.status, { message }));
        };
        xhr.onerror = () => reject(new ApiError(0, { message: "The upload was interrupted. Check your connection and try again." }));
        xhr.send(file);
      }),
  );
}

/** The start of an upload by someone signed in, for a record. */
export const startFor = (entity: string, entityId: string) => (meta: { name: string; mime: string; size: number }) =>
  api<UploadStart>("/files", { body: { ...meta, entity, entityId } });

/** A button that picks files and uploads them one after another. */
export function UploadButton({
  start,
  onUploaded,
  label = "Upload files",
  size = "sm",
  variant = "secondary",
}: {
  start: (meta: { name: string; mime: string; size: number }) => Promise<UploadStart>;
  onUploaded: (id: string, file: File) => void;
  label?: string;
  size?: "sm" | "xs";
  variant?: "secondary" | "soft" | "default";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          for (const f of files) {
            try {
              const id = await uploadFile(start, f, (pct) => setProgress(`${f.name} · ${pct}%`));
              onUploaded(id, f);
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }
          setProgress(null);
        }}
      />
      <Button type="button" size={size} variant={variant} disabled={!!progress} onClick={() => input.current?.click()}>
        {progress ? <Loader2 className="animate-spin" /> : <FileUp />}
        {progress ?? label}
      </Button>
    </>
  );
}

/** A record's files: list with download links, upload, remove. */
export function FilesCard({
  entity,
  entityId,
  title,
  description,
  canEdit,
}: {
  entity: string;
  entityId: string;
  title: string;
  description?: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const files = useFiles(entity, entityId);
  const remove = useDeleteFile();
  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        canEdit && (
          <UploadButton
            start={startFor(entity, entityId)}
            onUploaded={(_id, f) => {
              toast.success(`${f.name} uploaded`);
              qc.invalidateQueries({ queryKey: ["files", entity, entityId] });
            }}
          />
        )
      }
    >
      {files.isPending ? (
        <SkeletonRows rows={2} />
      ) : files.error ? (
        <Alert tone="danger">{errorMessage(files.error)}</Alert>
      ) : !files.data.length ? (
        <p className="text-body text-muted-foreground">No files yet.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {files.data.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <a
                  href={f.url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("block truncate text-body font-medium", f.url && "hover:underline")}
                >
                  {f.name}
                </a>
                <span className="text-body text-muted-foreground">
                  {fileSize(f.size)} · {fmtDate(f.createdAt)}
                </span>
              </span>
              {f.url && (
                <Button size="icon-sm" variant="ghost" asChild aria-label={`Download ${f.name}`}>
                  <a href={f.url} download={f.name}>
                    <Download />
                  </a>
                </Button>
              )}
              {canEdit && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => remove.mutate(f.id, { onSuccess: () => toast.success(`${f.name} removed`), onError: (e) => toast.error(errorMessage(e)) })}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
