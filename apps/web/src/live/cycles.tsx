"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Lock, Repeat } from "lucide-react";
import { toast } from "sonner";
import type { CycleRow } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { inr } from "./packages";
import { MonthSwitcher, monthLabel, thisMonth } from "./production-bits";
import { useCan, useCycleAction, useCycles } from "./queries";

const STATUS: Record<CycleRow["status"], { label: string; tone: BadgeTone }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  in_progress: { label: "This month", tone: "info" },
  reconciling: { label: "To close", tone: "warning" },
  closed: { label: "Closed", tone: "success" },
};
const DECISION = { carry: "Carried to next month", credit: "Credited", forfeit: "Given up by the client" } as const;

function Bar({ c }: { c: CycleRow }) {
  const total = Math.max(1, c.promised);
  const seg = (n: number, cls: string, label: string) => n > 0 && <span className={cls} style={{ width: `${(n / total) * 100}%` }} title={`${n} ${label}`} />;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
      {seg(c.delivered, "bg-success", "delivered")}
      {seg(c.inMaking, "bg-info", "in the making")}
      {seg(c.planned, "bg-border-strong", "planned")}
    </div>
  );
}

function CloseDialog({ c, open, onOpenChange }: { c: CycleRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const act = useCycleAction();
  const shortfall = Math.max(0, c.promised - c.delivered);
  const [decision, setDecision] = useState<"carry" | "credit" | "forfeit">("carry");
  const [note, setNote] = useState("");
  const credit = Math.round((c.agreement.monthlyFee / Math.max(1, c.promised)) * shortfall);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Close {monthLabel(c.month)} for {c.client.name}
          </DialogTitle>
          <DialogDescription>
            {c.delivered} of {c.promised} videos delivered.{shortfall ? ` ${shortfall} short — decide what happens to them.` : " Nothing short."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {shortfall > 0 &&
            (
              [
                ["carry", "Carry to next month", `${shortfall} more videos promised next month.`],
                ["credit", "Credit the client", `A credit of ${inr(credit)} (the month's fee per video × ${shortfall}).`],
                ["forfeit", "The client gives them up", "When the shortfall was the client's doing — say why."],
              ] as const
            ).map(([k, label, hint]) => (
              <label
                key={k}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-body",
                  decision === k ? "border-primary bg-primary-soft/40" : "border-border",
                )}
              >
                <input type="radio" name="decision" className="mt-1" checked={decision === k} onChange={() => setDecision(k)} />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          <Field label="Note">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {act.error && <Alert tone="danger">{errorMessage(act.error)}</Alert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || (shortfall > 0 && decision === "forfeit" && !note.trim())}
            onClick={() =>
              act.mutate(
                { step: "close", id: c.id, decision: shortfall ? decision : undefined, note: note || undefined },
                { onSuccess: () => (toast.success("Month closed"), onOpenChange(false)) },
              )
            }
          >
            <Lock />
            Close the month
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LiveCycles() {
  const can = useCan();
  const [month, setMonth] = useState(thisMonth());
  const cycles = useCycles(month);
  const act = useCycleAction();
  const [closing, setClosing] = useState<CycleRow | null>(null);
  const list = cycles.data ?? [];
  const totals = list.reduce((t, c) => ({ promised: t.promised + c.promised, delivered: t.delivered + c.delivered }), { promised: 0, delivered: 0 });
  return (
    <>
      <PageHeader
        title="Monthly delivery"
        description="Each running agreement's month: videos promised against delivered. A past month is closed with a decision on any shortfall."
        actions={
          <>
            <MonthSwitcher month={month} onChange={setMonth} />
            {can("production", "edit") && list.length > 0 && (
              <Button
                variant="secondary"
                disabled={act.isPending}
                onClick={() =>
                  act.mutate(
                    { step: "generate", month },
                    {
                      onSuccess: () => toast.success(`${monthLabel(month)} is set up for every running agreement`),
                      onError: (e) => toast.error(errorMessage(e)),
                    },
                  )
                }
              >
                <CalendarPlus />
                Set up {monthLabel(month)}
              </Button>
            )}
          </>
        }
      />
      {cycles.isPending ? (
        <SkeletonRows rows={5} />
      ) : cycles.error ? (
        <Alert tone="danger">{errorMessage(cycles.error)}</Alert>
      ) : !list.length ? (
        <EmptyState
          icon={Repeat}
          title={`Nothing for ${monthLabel(month)}`}
          description="A month is set up for an agreement when its first video is made, or for every running agreement here."
          action={
            can("production", "edit") && (
              <Button onClick={() => act.mutate({ step: "generate", month }, { onError: (e) => toast.error(errorMessage(e)) })}>
                <CalendarPlus />
                Set up {monthLabel(month)}
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-body text-muted-foreground">
            {totals.delivered} of {totals.promised} videos delivered across {list.length === 1 ? "1 client" : `${list.length} clients`}.
          </p>
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>Client</TH>
                  <TH>Delivered · in the making · planned</TH>
                  <TH numeric>Promised</TH>
                  <TH>Status</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {list.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link href={`/app/clients/${c.client.id}`} className="font-medium hover:underline">
                        {c.client.name}
                      </Link>
                      <div className="text-muted-foreground">{c.agreement.title}</div>
                    </TD>
                    <TD className="min-w-56">
                      <Bar c={c} />
                      <div className="mt-1 text-muted-foreground">
                        {c.delivered} · {c.inMaking} · {c.planned}
                        {c.notStarted > 0 && ` · ${c.notStarted} not started`}
                      </div>
                    </TD>
                    <TD numeric>
                      {c.promised}
                      {c.carriedIn > 0 && <div className="text-muted-foreground">incl. {c.carriedIn} carried</div>}
                    </TD>
                    <TD>
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                      {c.decision && (
                        <div className="mt-1 text-muted-foreground">
                          {DECISION[c.decision]}
                          {c.credit ? ` · ${inr(c.credit)}` : ""}
                        </div>
                      )}
                    </TD>
                    <TD>
                      {c.status === "reconciling" && can("agreements", "approve") && (
                        <Button size="xs" variant="secondary" onClick={() => setClosing(c)}>
                          Close the month
                        </Button>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </>
      )}
      {closing && <CloseDialog c={closing} open onOpenChange={(o) => !o && setClosing(null)} />}
    </>
  );
}
