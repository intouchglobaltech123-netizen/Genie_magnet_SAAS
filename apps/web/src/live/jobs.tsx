"use client";

import { useState } from "react";
import { RotateCw, Timer } from "lucide-react";
import { toast } from "sonner";
import { JOB_STATUS_LABEL, type JobRow } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "./api";
import { fmtDate } from "./format";
import { useCan, useJobOverview, useJobs, useRetryJob } from "./queries";

const TONE: Record<JobRow["status"], BadgeTone> = { queued: "neutral", running: "info", done: "success", failed: "danger" };
const n = (r: Record<string, unknown>, k: string) => Number(r[k] ?? 0);
/** What a finished run did, in a few words. */
function outcome(j: JobRow) {
  if (j.status !== "done" || !j.result || typeof j.result !== "object") return null;
  const r = j.result as Record<string, unknown>;
  switch (j.name) {
    case "videos.due":
      return `${n(r, "dueTomorrow")} due tomorrow · ${n(r, "late")} newly late`;
    case "onboarding.reminders":
      return `${n(r, "reminders")} reminders to send · ${n(r, "overdue")} past the window`;
    case "agreements.renewals":
      return `${n(r, "renewalsDue")} to renew · ${n(r, "endedWithoutRenewal")} ended without a renewal`;
    case "invoices.overdue":
      return `${n(r, "overdue")} newly overdue`;
    case "cycles.month":
      return `${n(r, "set")} months set up · ${n(r, "toClose")} to close`;
    case "files.cleanup":
      return `${n(r, "removed")} cleared`;
    default:
      return null;
  }
}
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function JobTable({ rows, canRetry }: { rows: JobRow[]; canRetry: boolean }) {
  const retry = useRetryJob();
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH>Job</TH>
            <TH>For</TH>
            <TH>Status</TH>
            <TH numeric>Tries</TH>
            <TH>When</TH>
            <TH />
          </TR>
        </THead>
        <TBody>
          {rows.map((j) => (
            <TR key={j.id}>
              <TD className="max-w-md">
                <div className="font-medium">{j.label}</div>
                {j.lastError && j.status !== "done" && <div className="text-danger">{j.lastError}</div>}
                {outcome(j) && <div className="text-muted-foreground">{outcome(j)}</div>}
              </TD>
              <TD>{j.date ? fmtDate(j.date) : "—"}</TD>
              <TD>
                <Badge tone={TONE[j.status]}>{JOB_STATUS_LABEL[j.status]}</Badge>
              </TD>
              <TD numeric>
                {j.attempts} of {j.maxAttempts}
              </TD>
              <TD className="text-muted-foreground">{j.finishedAt ? when(j.finishedAt) : j.status === "queued" ? `from ${when(j.runAt)}` : when(j.runAt)}</TD>
              <TD>
                {j.status === "failed" && canRetry && (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={retry.isPending}
                    onClick={() =>
                      retry.mutate(j.id, { onSuccess: () => toast.success("It will run again in a moment"), onError: (e) => toast.error(errorMessage(e)) })
                    }
                  >
                    <RotateCw />
                    Try again
                  </Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

export function LiveJobs() {
  const can = useCan();
  const overview = useJobOverview();
  const [tab, setTab] = useState<"failed" | "all">("failed");
  const list = useJobs(tab === "failed" ? "failed" : "");
  const o = overview.data;
  return (
    <>
      <PageHeader
        title="Background jobs"
        description="What the app does by itself each morning — reminders about videos, onboarding, renewals and invoices, setting up the month — and anything that failed. A failed job is tried four more times before it shows here."
      />
      {overview.error ? (
        <Alert tone="danger">{errorMessage(overview.error)}</Alert>
      ) : (
        <SectionCard title="Every morning" description="The latest run of each daily check.">
          {!o ? (
            <SkeletonRows rows={6} />
          ) : (
            <ul className="divide-y divide-border">
              {o.daily.map((d) => (
                <li key={d.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-body">
                  <span>{d.label}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {d.date ? fmtDate(d.date) : "Not run yet"}
                    {d.status && <Badge tone={TONE[d.status]}>{JOB_STATUS_LABEL[d.status]}</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
      <Tabs value={tab} onValueChange={(v) => setTab(v as "failed" | "all")} className="mt-6">
        <TabsList>
          <TabsTrigger value="failed">Needs a look{o?.failed ? ` (${o.failed})` : ""}</TabsTrigger>
          <TabsTrigger value="all">Recent</TabsTrigger>
        </TabsList>
        {(["failed", "all"] as const).map((v) => (
          <TabsContent key={v} value={v} className="mt-4">
            {list.isPending ? (
              <SkeletonRows rows={5} />
            ) : list.error ? (
              <Alert tone="danger">{errorMessage(list.error)}</Alert>
            ) : !list.data?.length ? (
              <EmptyState
                icon={Timer}
                title={v === "failed" ? "Nothing failed" : "Nothing has run yet"}
                description={v === "failed" ? "Every job finished, or is still being tried." : "The daily checks run each morning."}
              />
            ) : (
              <JobTable rows={list.data} canRetry={can("settings", "edit")} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
