// File uploads (P1-05): what can be uploaded, and what it can belong to.
import { z } from "zod";

/** Kinds of file people upload, by type and file extension. */
export const FILE_TYPES = [
  { group: "Images", mimes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/heic"], ext: ["png", "jpg", "jpeg", "webp", "gif", "heic"] },
  { group: "Videos", mimes: ["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"], ext: ["mp4", "mov", "webm", "mkv"] },
  { group: "Audio", mimes: ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"], ext: ["mp3", "wav", "m4a", "aac"] },
  {
    group: "Documents",
    mimes: [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    ext: ["pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "ppt", "pptx"],
  },
  {
    group: "Brand and design",
    mimes: ["font/ttf", "font/otf", "font/woff", "font/woff2", "application/zip", "application/x-zip-compressed"],
    ext: ["ttf", "otf", "woff", "woff2", "zip"],
  },
] as const;

const allowedMimes = new Set<string>(FILE_TYPES.flatMap((t) => t.mimes));
const allowedExt = new Set<string>(FILE_TYPES.flatMap((t) => t.ext));
export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Accepted when both the type and the file extension are on the list (browsers sometimes send an empty type). */
export const fileAllowed = (name: string, mime: string) => allowedExt.has(extOf(name)) && (!mime || allowedMimes.has(mime));

/** For the file picker's `accept`. */
export const ACCEPT = FILE_TYPES.flatMap((t) => t.ext.map((e) => `.${e}`)).join(",");

/** What a file can belong to, and the area whose access decides who may see and change it. */
export const FILE_ENTITIES = {
  client: "clients",
  onboarding: "onboarding",
  video: "production",
  publishing: "publishing",
  content: "content",
  agency: "settings",
  /** Receipts: finance, and the person who submitted the expense. */
  expense: "finance",
} as const;
export type FileEntity = keyof typeof FILE_ENTITIES;

export const fileStart = z
  .object({
    name: z.string().trim().min(1).max(200, "Keep the file name under 200 characters"),
    mime: z.string().max(120).default(""),
    size: z.number().int().positive("The file is empty"),
    entity: z.enum(Object.keys(FILE_ENTITIES) as [FileEntity, ...FileEntity[]]),
    entityId: z.string().min(1).max(64),
  })
  .refine((f) => fileAllowed(f.name, f.mime), { path: ["name"], message: "This kind of file cannot be uploaded" });
export type FileStart = z.input<typeof fileStart>;

/** 1.2 MB, 340 KB… */
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
