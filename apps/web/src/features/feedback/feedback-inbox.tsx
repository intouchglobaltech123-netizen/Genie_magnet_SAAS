"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, MessageSquarePlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES, FEEDBACK_TYPES, labelOf, type FeedbackRow } from "./meta";

const typeTone: Record<string, BadgeTone> = { change: "accent", missing: "info", bug: "danger", question: "neutral", good: "success" };
const statusTone: Record<string, BadgeTone> = { open: "warning", planned: "info", done: "success", wontdo: "neutral" };

const ALL = "all";

async function fetchFeedback(): Promise<FeedbackRow[] | null> {
  try {
    const res = await fetch("/api/feedback", { cache: "no-store" });
    return res.ok ? ((await res.json()) as FeedbackRow[]) : null;
  } catch {
    return null;
  }
}

function toCsv(rows: FeedbackRow[]) {
  const head = ["Date", "Name", "Module", "Page", "Viewing as", "Type", "Priority", "Status", "Comment"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toLocaleString("en-IN"),
      r.name,
      r.module,
      r.page,
      r.role,
      labelOf(FEEDBACK_TYPES, r.type),
      labelOf(FEEDBACK_PRIORITIES, r.priority),
      labelOf(FEEDBACK_STATUSES, r.status),
      r.text,
    ]
      .map(esc)
      .join(","),
  );
  return [head.map(esc).join(","), ...lines].join("\n");
}

/** Every comment reviewers left through the Feedback button, grouped for the rework plan. */
export function FeedbackInbox() {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [mod, setMod] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const load = useCallback(
    () =>
      fetchFeedback().then((r) => {
        if (!r) toast.error("Could not load feedback");
        setRows(r ?? []);
      }),
    [],
  );

  useEffect(() => {
    let live = true;
    fetchFeedback().then((r) => {
      if (!live) return;
      if (!r) toast.error("Could not load feedback");
      setRows(r ?? []);
    });
    return () => {
      live = false;
    };
  }, []);

  const modules = useMemo(() => [...new Set((rows ?? []).map((r) => r.module))].sort(), [rows]);
  const shown = (rows ?? []).filter((r) => (mod === ALL || r.module === mod) && (type === ALL || r.type === type) && (status === ALL || r.status === status));

  const setRowStatus = async (id: string, next: string) => {
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, status: next } : r)) ?? rs);
    const res = await fetch("/api/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: next }) });
    if (!res.ok) {
      toast.error("Could not update status");
      void load();
    }
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(shown)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agency-os-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const all = rows ?? [];
  const count = (pred: (r: FeedbackRow) => boolean) => all.filter(pred).length;

  return (
    <>
      <PageHeader
        eyebrow="Demo review"
        title="Feedback inbox"
        description="Every comment left with the Feedback button, tagged with the screen and role it was given on. Use it to plan the rework."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw /> Refresh
            </Button>
            <Button onClick={exportCsv} disabled={!shown.length}>
              <Download /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total comments" value={all.length} />
        <StatCard label="Open" value={count((r) => r.status === "open")} />
        <StatCard label="Must have" value={count((r) => r.priority === "must" && r.status !== "done" && r.status !== "wontdo")} />
        <StatCard label="Modules mentioned" value={modules.length} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-subtle p-4 sm:flex-row">
          <Select
            className="sm:w-56"
            value={mod}
            onValueChange={setMod}
            aria-label="Filter by module"
            options={[{ value: ALL, label: "All modules" }, ...modules.map((m) => ({ value: m, label: m }))]}
          />
          <Select className="sm:w-48" value={type} onValueChange={setType} aria-label="Filter by type" options={[{ value: ALL, label: "All types" }, ...FEEDBACK_TYPES]} />
          <Select className="sm:w-40" value={status} onValueChange={setStatus} aria-label="Filter by status" options={[{ value: ALL, label: "All statuses" }, ...FEEDBACK_STATUSES]} />
        </div>

        {rows === null ? (
          <div className="p-4">
            <SkeletonRows rows={5} />
          </div>
        ) : shown.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={MessageSquarePlus}
              title={all.length ? "No feedback matches these filters" : "No feedback yet"}
              description={all.length ? "Clear a filter to see more." : "Open any screen and use the Feedback button, bottom right, to leave the first comment."}
              action={
                !all.length && (
                  <Button asChild variant="outline">
                    <Link href="/">Go to dashboard</Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Comment</TH>
                <TH>Module</TH>
                <TH>Type</TH>
                <TH>From</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map((r) => (
                <TR key={r.id}>
                  <TD className="min-w-72 max-w-xl align-top">
                    <p className="whitespace-pre-wrap">{r.text}</p>
                    <p className="mt-1 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </TD>
                  <TD className="align-top">
                    <Link href={r.page} className="font-medium text-primary hover:underline dark:text-text-primary">
                      {r.module}
                    </Link>
                    {r.role && <p className="text-muted-foreground">as {r.role}</p>}
                  </TD>
                  <TD className="align-top">
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={typeTone[r.type] ?? "neutral"}>{labelOf(FEEDBACK_TYPES, r.type)}</Badge>
                      {r.priority === "must" && <Badge tone="outline">Must have</Badge>}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap align-top">{r.name}</TD>
                  <TD className="align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge tone={statusTone[r.status] ?? "neutral"} dot>
                        {labelOf(FEEDBACK_STATUSES, r.status)}
                      </Badge>
                      <Select
                        className="w-32"
                        value={r.status}
                        onValueChange={(v) => void setRowStatus(r.id, v)}
                        aria-label="Change status"
                        options={[...FEEDBACK_STATUSES]}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
