"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { ImportKind, ImportReport } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { errorMessage } from "./api";
import { useImportDetail } from "./queries";

const WHAT: Record<ImportKind, string> = { clients: "Clients", team: "Team", leads: "Leads", videos: "Videos in progress", agreements: "Agreements" };

/**
 * The check report of an import (P3-12): the figures to compare with the sheet's own totals, the rows left out and
 * why, and things worth a look that did not stop the import.
 */
export function CheckReportView({ report }: { report: ImportReport }) {
  return (
    <div className="space-y-4">
      <SectionCard
        title="Compare with your sheet"
        description={`${report.rows} rows in the file: ${report.imported} imported${report.leftOut.length ? `, ${report.leftOut.length} left out` : ""}. These figures should match your sheet's own totals.`}
      >
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.totals.map((t) => (
            <div key={t.label} className="flex items-baseline justify-between gap-3 border-b border-border-subtle py-1.5">
              <dt className="text-body text-muted-foreground">{t.label}</dt>
              <dd className="font-medium tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
      {report.leftOut.length > 0 && (
        <SectionCard title="Left out" description="Fix these rows in your file and import them on their own." contentClassName="p-0">
          <Table>
            <THead>
              <TR>
                <TH className="w-20">Row</TH>
                <TH>What needs fixing</TH>
              </TR>
            </THead>
            <TBody>
              {report.leftOut.map((r) => (
                <TR key={r.line}>
                  <TD className="align-top tabular-nums">{r.line}</TD>
                  <TD>
                    <ul className="space-y-0.5">
                      {r.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </SectionCard>
      )}
      <SectionCard
        title="Worth a look"
        description={report.notes.length ? "These were imported; check each against your records." : undefined}
        contentClassName={report.notes.length ? "p-0" : undefined}
      >
        {report.notes.length ? (
          <Table>
            <THead>
              <TR>
                <TH className="w-20">Row</TH>
                <TH>Note</TH>
              </TR>
            </THead>
            <TBody>
              {report.notes.map((n, i) => (
                <TR key={i}>
                  <TD className="align-top tabular-nums">{n.line ?? "—"}</TD>
                  <TD>{n.text}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="text-body text-muted-foreground">Nothing to point out.</p>
        )}
      </SectionCard>
    </div>
  );
}

/** /app/import/[id]: one import's check report, to print or keep. */
export function LiveImportReport({ id }: { id: string }) {
  const q = useImportDetail(id);
  const i = q.data;
  return (
    <>
      <PageHeader
        title={i ? `Check report · ${i.fileName}` : "Check report"}
        description={
          i
            ? `${WHAT[i.kind]}, imported ${new Date(i.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}${i.createdBy ? ` by ${i.createdBy}` : ""}.`
            : undefined
        }
        actions={
          <span className="flex gap-2 print:hidden">
            <Button variant="ghost" asChild>
              <Link href={i ? `/app/import?kind=${i.kind}` : "/app/import"}>
                <ArrowLeft />
                Import from Excel
              </Link>
            </Button>
            {i?.report && (
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer />
                Print
              </Button>
            )}
          </span>
        }
      />
      {q.isPending ? (
        <SkeletonRows rows={6} />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : (
        <div className="space-y-4">
          {i!.undoneAt && (
            <Alert tone="warning">
              This import was undone on {new Date(i!.undoneAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: what it added has been removed.{" "}
              <Badge tone="neutral">Undone</Badge>
            </Alert>
          )}
          {i!.report ? <CheckReportView report={i!.report} /> : <Alert tone="info">This import was made before check reports were kept.</Alert>}
        </div>
      )}
    </>
  );
}
