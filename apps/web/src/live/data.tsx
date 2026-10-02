"use client";

import { useState } from "react";
import { DatabaseBackup, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DELETION_GRACE_DAYS, type DataExportRow, OWNER_ROLE } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/utils";
import { errorMessage } from "./api";
import { istDay } from "./plan";
import { useDataAction, useDataExports, useMe } from "./queries";

const when = (at: string) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const longDay = (at: string) => fmtDate(istDay(at), { day: "numeric", month: "long", year: "numeric" });
const MB = 1024 ** 2;
const size = (bytes: number) => (bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`);

/** Settings → Your data (P6-10): the owner's full export, and deleting the workspace after a grace period. */
export function LiveData() {
  const me = useMe().data;
  const owner = me?.role?.key === OWNER_ROLE && !me.support;
  return (
    <>
      <PageHeader
        title="Your data"
        description="Everything your agency keeps here is yours. Take all of it away as a file you can open anywhere, or delete the workspace when you leave."
      />
      {me && !owner && (
        <Alert tone="info" className="mb-5">
          Only the agency&apos;s owner can export its data or delete the workspace.
        </Alert>
      )}
      {owner && <Exports />}
      {me && <Deletion owner={owner} agencyName={me.agencies.find((a) => a.id === me.activeAgencyId)?.name ?? ""} />}
    </>
  );
}

function Exports() {
  const q = useDataExports(true);
  const act = useDataAction();
  const making = q.data?.some((e) => e.status === "queued");
  return (
    <SectionCard
      title="Export everything"
      description="One ZIP file: a spreadsheet (CSV) for each kind of record, and all of it again in data.json. Passwords, keys, bank account and PAN numbers, and each person's own financial planner are left out; uploaded files are listed, not included."
      actions={
        <Button
          variant="accent"
          disabled={act.isPending || making}
          onClick={() =>
            act.mutate(
              { step: "export" },
              { onSuccess: () => toast.success("Making the export. It is ready in a minute or two."), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        >
          {making ? <Loader2 className="animate-spin" /> : <DatabaseBackup />} {making ? "Making the export…" : "Make an export"}
        </Button>
      }
      className="mb-5"
    >
      {q.isPending ? (
        <SkeletonRows rows={2} />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : !q.data.length ? (
        <EmptyState compact icon={DatabaseBackup} title="No exports yet" description="Make one whenever you want a copy of everything." />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {q.data.map((e) => (
            <ExportItem key={e.id} e={e} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ExportItem({ e }: { e: DataExportRow }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-body font-medium">
          Export of {when(e.createdAt)}
          {e.status === "queued" && <Badge tone="info">Being made</Badge>}
          {e.status === "failed" && <Badge tone="danger">Could not be made</Badge>}
        </div>
        <div className="text-body text-muted-foreground">
          {e.status === "ready" && e.size !== null
            ? `${e.tables} tables · ${(e.rows ?? 0).toLocaleString("en-IN")} records · ${size(e.size)}`
            : e.status === "failed"
              ? (e.error ?? "Something went wrong. Make another one.")
              : "It is ready in a minute or two; you will get a notification."}
          {e.requestedBy.name ? ` · asked for by ${e.requestedBy.name}` : ""}
        </div>
      </div>
      {e.status === "ready" && (
        <Button asChild variant="outline" size="sm">
          <a href={`/api/data/exports/${e.id}/download`} download>
            <Download /> Download
          </a>
        </Button>
      )}
    </li>
  );
}

function Deletion({ owner, agencyName }: { owner: boolean; agencyName: string }) {
  const deletion = useMe().data?.deletion;
  const act = useDataAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === agencyName.trim().toLowerCase() && typed.trim() !== "";
  if (!owner && !deletion) return null;
  return (
    <SectionCard
      title="Delete the workspace"
      description={`Deleting removes the agency and everything in it — clients, money, people, files — for everyone. It happens ${DELETION_GRACE_DAYS} days after you ask, and until then you can stop it.`}
    >
      {deletion ? (
        <Alert tone="danger" title={`${agencyName} will be deleted on ${longDay(deletion.deleteAfter)}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {deletion.requestedBy.name ?? "The owner"} asked for this on {longDay(deletion.requestedAt)}. Export anything you need before then.
            </span>
            {owner && (
              <Button
                size="sm"
                variant="outline"
                disabled={act.isPending}
                onClick={() =>
                  act.mutate(
                    { step: "keep" },
                    { onSuccess: () => toast.success("The workspace will not be deleted"), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
              >
                Keep the workspace
              </Button>
            )}
          </div>
        </Alert>
      ) : (
        <Button variant="danger" onClick={() => (setTyped(""), setOpen(true))}>
          <Trash2 /> Delete the workspace…
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!matches) return;
              act.mutate(
                { step: "delete", confirm: typed },
                {
                  onSuccess: () => (setOpen(false), toast(`The workspace will be deleted in ${DELETION_GRACE_DAYS} days`)),
                  onError: (e) => toast.error(errorMessage(e)),
                },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>Delete {agencyName}?</DialogTitle>
              <DialogDescription>
                In {DELETION_GRACE_DAYS} days the agency and everything in it is deleted for everyone, and cannot be brought back. Until then you can stop it
                here. Make an export first if you want to keep a copy.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field label={`Type the agency's name, ${agencyName}, to confirm`}>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={!matches || act.isPending}>
                <Trash2 /> Delete in {DELETION_GRACE_DAYS} days
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
