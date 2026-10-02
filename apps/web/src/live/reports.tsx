"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileBarChart, Printer, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { METRIC_KEYS, METRIC_LABEL, type MonthlyReport } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "./api";
import { fmtDate } from "./format";
import { PLATFORM_LABEL } from "./packages";
import { MonthSwitcher, monthLabel, thisMonth } from "./production-bits";
import { useCan, useMakeReport, usePostMetrics, useReport, useReportAction, useReports } from "./queries";
import { ReportDocument } from "./report-document";

/** Reports: each client with a running agreement in the month, and its report. */
export function LiveReports() {
  const can = useCan();
  const router = useRouter();
  const [month, setMonth] = useState(thisMonth());
  const rows = useReports(month);
  const make = useMakeReport();
  return (
    <>
      <PageHeader
        title="Monthly reports"
        description="What each client's month delivered and achieved. Drafts are made by themselves on the 25th; add a note and release each one to the client's portal."
        actions={<MonthSwitcher month={month} onChange={setMonth} />}
      />
      {rows.isPending ? (
        <SkeletonRows rows={5} />
      ) : rows.error ? (
        <Alert tone="danger">{errorMessage(rows.error)}</Alert>
      ) : !rows.data.length ? (
        <EmptyState
          icon={FileBarChart}
          title={`No clients running in ${monthLabel(month)}`}
          description="A report is made for each client with a running agreement."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Client</TH>
                <TH>Report</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.data.map((r) => (
                <TR key={r.client.id}>
                  <TD className="font-medium">{r.client.name}</TD>
                  <TD>
                    {!r.report ? (
                      <span className="text-muted-foreground">Not made yet</span>
                    ) : r.report.status === "released" ? (
                      <Badge tone="success">Released {r.report.releasedAt ? fmtDate(r.report.releasedAt) : ""}</Badge>
                    ) : (
                      <Badge tone="warning">Draft</Badge>
                    )}
                  </TD>
                  <TD className="text-right">
                    {r.report ? (
                      <Button size="xs" variant="secondary" asChild>
                        <Link href={`/app/reports/${r.report.id}`}>Open</Link>
                      </Button>
                    ) : (
                      can("clients", "edit") && (
                        <Button
                          size="xs"
                          variant="secondary"
                          disabled={make.isPending}
                          onClick={() =>
                            make.mutate(
                              { clientId: r.client.id, month },
                              { onSuccess: (rep) => router.push(`/app/reports/${rep.id}`), onError: (e) => toast.error(errorMessage(e)) },
                            )
                          }
                        >
                          Make the report
                        </Button>
                      )
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}

function Numbers({ r, onSaved }: { r: MonthlyReport; onSaved: () => void }) {
  const save = usePostMetrics();
  const posts = r.data.videos.flatMap((v) => v.posts.map((p) => ({ ...p, video: v })));
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(posts.map((p) => [p.id, Object.fromEntries(METRIC_KEYS.map((k) => [k, p.metrics?.[k] != null ? String(p.metrics[k]) : ""]))])),
  );
  if (!posts.length) return null;
  return (
    <SectionCard
      title="Numbers for each post"
      description="From each platform's insights, until the platform connections bring them in. Save, then refresh the report."
    >
      <ul className="space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="space-y-2 rounded-lg border border-border p-3 text-body">
            <div className="font-medium">
              {p.video.title} · {PLATFORM_LABEL[p.platform] ?? p.platform}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {METRIC_KEYS.map((k) => (
                <Input
                  key={k}
                  aria-label={METRIC_LABEL[k]}
                  placeholder={METRIC_LABEL[k]}
                  inputMode="numeric"
                  value={values[p.id]?.[k] ?? ""}
                  onChange={(e) => setValues({ ...values, [p.id]: { ...values[p.id], [k]: e.target.value.replace(/\D/g, "") } })}
                />
              ))}
            </div>
            <Button
              size="xs"
              variant="secondary"
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  { postId: p.id, values: Object.fromEntries(METRIC_KEYS.map((k) => [k, values[p.id]?.[k] ? Number(values[p.id]![k]) : null])) },
                  { onSuccess: () => (toast.success("Saved"), onSaved()), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              Save the numbers
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** One report: the note, the numbers, refresh and release — and the document as the client will see it. */
export function LiveReport({ id }: { id: string }) {
  const can = useCan();
  const report = useReport(id);
  const act = useReportAction(id);
  const [note, setNote] = useState<string | null>(null);
  if (report.isPending) return <SkeletonRows rows={8} />;
  if (report.error) return <Alert tone="danger">{errorMessage(report.error)}</Alert>;
  const r = report.data;
  const canEdit = can("clients", "edit") && r.status === "draft";
  const text = note ?? r.note ?? "";
  const run = (v: Parameters<typeof act.mutate>[0], done: string) =>
    act.mutate(v, { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <>
      <div className="print:hidden">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/app/reports">
            <ArrowLeft />
            Reports
          </Link>
        </Button>
        <PageHeader
          title={`${r.client.name} · ${monthLabel(r.month)}`}
          description={
            r.status === "released"
              ? `Released ${r.releasedAt ? fmtDate(r.releasedAt) : ""}${r.releasedBy?.name ? ` by ${r.releasedBy.name}` : ""} — the client sees it in their portal.`
              : "A draft: check it, add a note, and release it to the client."
          }
          actions={
            <>
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
              {canEdit && (
                <>
                  <Button variant="secondary" disabled={act.isPending} onClick={() => run({ step: "refresh" }, "Brought up to date")}>
                    <RefreshCw />
                    Refresh
                  </Button>
                  <Button disabled={act.isPending} onClick={() => run({ step: "release" }, "Released to the client")}>
                    <Send />
                    Release
                  </Button>
                </>
              )}
            </>
          }
        />
        {canEdit && (
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <SectionCard title="Your note" description="A few lines for the client: what went well, what is next.">
              <Textarea rows={5} value={text} onChange={(e) => setNote(e.target.value)} />
              <Button
                size="sm"
                className="mt-2"
                disabled={act.isPending || text === (r.note ?? "")}
                onClick={() => run({ step: "note", note: text || null }, "Note saved")}
              >
                Save the note
              </Button>
            </SectionCard>
            {can("publishing", "edit") && <Numbers key={r.updatedAt} r={r} onSaved={() => undefined} />}
          </div>
        )}
      </div>
      <ReportDocument report={{ ...r, note: canEdit ? text || null : r.note }} />
    </>
  );
}
