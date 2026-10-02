// The agency's own data (P6-10): a full export, CSV per table and a JSON archive in one ZIP, for the owner to take
// away; and deleting the workspace, after a grace period in which the owner can still change their mind.
import { z } from "zod";

export const EXPORT_STATUSES = ["queued", "ready", "failed"] as const;
export type ExportStatus = (typeof EXPORT_STATUSES)[number];

/** GET /data/exports (one item) */
export interface DataExportRow {
  id: string;
  status: ExportStatus;
  requestedBy: { id: string; name: string | null };
  createdAt: string;
  readyAt: string | null;
  /** Bytes of the ZIP file. */
  size: number | null;
  tables: number | null;
  rows: number | null;
  error: string | null;
}

/** Days between asking for the workspace to be deleted and it being deleted. */
export const DELETION_GRACE_DAYS = 30;

/** POST /data/deletion: the agency's name, typed to confirm. */
export const deletionInput = z.object({ confirm: z.string().trim().min(1, "Type the agency's name").max(200) });

/** GET /data/deletion, and on GET /me: when the workspace will be deleted, unless the owner stops it. */
export interface WorkspaceDeletion {
  requestedAt: string;
  deleteAfter: string;
  requestedBy: { id: string; name: string | null };
}
