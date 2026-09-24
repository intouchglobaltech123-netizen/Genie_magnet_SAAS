"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, IndianRupee, Layers, Lock, PackageCheck, Percent, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { agreementById, clientById, cycles } from "@/lib/mock/core";
import { carryRules, shortfallNotes } from "@/lib/mock/delivery";
import type { Cycle } from "@/lib/types";
import { cn, inr, pct } from "@/lib/utils";

const statusTone: Record<Cycle["status"], BadgeTone> = { upcoming: "neutral", "in-progress": "info", reconciling: "warning", closed: "success" };
const statusLabel: Record<Cycle["status"], string> = { upcoming: "Upcoming", "in-progress": "In progress", reconciling: "Reconciling", closed: "Closed · locked" };

type Decision = "carry" | "credit" | "forfeit";

export function ReconciliationPage() {
  const log = useDemo((s) => s.log);
  const [period, setPeriod] = useState("Aug 2026");
  const [statusOverride, setStatusOverride] = useState<Record<string, Cycle["status"]>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [rules, setRules] = useState(carryRules);
  const [closing, setClosing] = useState<Cycle | null>(null);
  const [ack, setAck] = useState(false);

  const rows = cycles.filter((c) => c.label === period).map((c) => ({ ...c, status: statusOverride[c.id] ?? c.status }));
  const promised = rows.reduce((s, c) => s + c.promised, 0);
  const delivered = rows.reduce((s, c) => s + c.delivered, 0);
  const revenue = rows.reduce((s, c) => s + c.revenue, 0);
  const cost = rows.reduce((s, c) => s + c.cost, 0);
  const margin = revenue ? (revenue - cost) / revenue : 0;
  const projected = period === "Sep 2026";

  const decisionOptions = (c: Cycle) => {
    const unit = Math.round(c.revenue / c.promised);
    const short = c.promised - c.delivered;
    return [
      { value: "carry", label: `Carry ${short} unit${short > 1 ? "s" : ""} → next cycle (founder sign-off)` },
      { value: "credit", label: `Credit note ${inr(unit * short)}` },
      { value: "forfeit", label: "Forfeit — client-caused (logged)" },
    ];
  };

  const confirmClose = () => {
    if (!closing) return;
    const client = clientById(closing.clientId);
    const d = decisions[closing.id];
    setStatusOverride((s) => ({ ...s, [closing.id]: "closed" }));
    log(`${client.name} · ${closing.label} period closed and locked${d ? ` (shortfall: ${d === "carry" ? "carried forward" : d === "credit" ? "credit note" : "forfeited"})` : ""}`, "success");
    toast.success(`${closing.label} closed for ${client.name}`, { description: "Figures locked. Later changes post as adjustments in the next open period." });
    setClosing(null);
    setAck(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Client Delivery · Module 22"
        depth="preview"
        title="Cycle Reconciliation"
        description="At month end, compare what each agreement promised with what was delivered, decide every shortfall explicitly, then lock the period."
        actions={
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="Aug 2026">Aug 2026</TabsTrigger>
              <TabsTrigger value="Sep 2026">Sep 2026</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Units delivered" value={`${delivered} / ${promised}`} icon={PackageCheck} tone="accent" hint={projected ? "month in progress" : `${promised - delivered} short`} />
        <StatCard label={projected ? "Revenue (contracted)" : "Revenue"} value={inr(revenue)} icon={IndianRupee} tone="success" hint={`${rows.length} cycles`} />
        <StatCard label={projected ? "Cost to date" : "Delivery cost"} value={inr(cost)} icon={Layers} tone="warning" hint="labour + equipment + rework" />
        <StatCard label="Gross margin" value={pct(margin)} icon={Percent} tone={margin < 0.3 ? "danger" : "gold"} hint={projected ? "projected, will move" : "before overheads"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{period} cycles</CardTitle>
              <CardDescription>{projected ? "Live — close opens after 30 Sep" : "Every shortfall needs a logged decision before the period can close"}</CardDescription>
            </div>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH className="pl-5">Client · package</TH>
                <TH className="text-right">Promised</TH>
                <TH className="text-right">Delivered</TH>
                <TH>Shortfall decision</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="text-right">Cost</TH>
                <TH>Margin</TH>
                <TH>Status</TH>
                <TH className="pr-5 text-right" />
              </TR>
            </THead>
            <TBody>
              {rows.map((c) => {
                const client = clientById(c.clientId);
                const ag = agreementById(c.agreementId);
                const short = c.promised - c.delivered;
                const m = (c.revenue - c.cost) / c.revenue;
                const note = shortfallNotes[c.id];
                return (
                  <TR key={c.id}>
                    <TD className="pl-5">
                      <div className="font-medium">{client.name}</div>
                      <div className="text-[12px] text-muted-foreground">{ag.packageName}</div>
                    </TD>
                    <TD className="text-right tabular">{c.promised}</TD>
                    <TD className="text-right tabular">
                      <span className={cn(short > 0 && !projected && "font-semibold text-warning")}>{c.delivered}</span>
                      {c.inProgress > 0 && <div className="text-[11px] text-muted-foreground">+{c.inProgress} in progress</div>}
                    </TD>
                    <TD className="min-w-[220px]">
                      {short === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[12.5px] text-success">
                          <CheckCircle2 className="size-3.5" /> Fully delivered
                        </span>
                      ) : projected ? (
                        <span className="text-[12.5px] text-muted-foreground">{short} open · decide at close</span>
                      ) : c.status === "reconciling" ? (
                        <div className="space-y-1">
                          <Select
                            value={decisions[c.id]}
                            onValueChange={(v) => {
                              setDecisions((d) => ({ ...d, [c.id]: v as Decision }));
                              toast("Decision recorded", { description: decisionOptions(c).find((o) => o.value === v)?.label });
                            }}
                            options={decisionOptions(c)}
                            placeholder={`Decide ${short} unit shortfall…`}
                            className="h-8 text-[12.5px]"
                          />
                          {note && (
                            <Tooltip content={note.reason}>
                              <span className="inline-flex cursor-help items-center gap-1 text-[11px] text-muted-foreground">
                                <AlertTriangle className="size-3 text-warning" /> {note.cause === "client" ? "Client-caused" : "Agency-caused"} · why?
                              </span>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground">
                          {decisions[c.id] ? decisionOptions(c).find((o) => o.value === decisions[c.id])?.label : `${short} carried forward (logged)`}
                        </span>
                      )}
                    </TD>
                    <TD className="text-right tabular">{inr(c.revenue)}</TD>
                    <TD className="text-right tabular">{inr(c.cost)}</TD>
                    <TD className="min-w-[110px]">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", m < 0.2 ? "bg-danger" : m < 0.35 ? "bg-warning" : "bg-success")} style={{ width: `${Math.max(0, m) * 100}%` }} />
                        </div>
                        <span className={cn("text-[12.5px] tabular", m < 0.2 && "text-danger")}>{pct(m)}</span>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={statusTone[c.status]} dot>
                        {statusLabel[c.status]}
                      </Badge>
                    </TD>
                    <TD className="pr-5 text-right">
                      {c.status === "reconciling" ? (
                        <Tooltip content={short > 0 && !decisions[c.id] ? "Decide the shortfall first — nothing carries forward silently" : "Lock this period"}>
                          <span>
                            <Button size="xs" variant="accent" disabled={short > 0 && !decisions[c.id]} onClick={() => setClosing(c)}>
                              <Lock className="!size-3" /> Close period
                            </Button>
                          </span>
                        </Tooltip>
                      ) : c.status === "closed" ? (
                        <Lock className="ml-auto size-3.5 text-muted-foreground" />
                      ) : (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => toast("Period still open", { description: `${client.name} ${c.label} can be reconciled after ${c.end.slice(8)} Sep` })}
                        >
                          Preview close
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Carry-forward rules</CardTitle>
              <CardDescription>Configurable per company · applied at every close</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {rules.map((r) => (
              <div key={r.id} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{r.label}</div>
                  <div className="text-[12px] text-muted-foreground">{r.desc}</div>
                </div>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => {
                    setRules((rs) => rs.map((x) => (x.id === r.id ? { ...x, enabled: v } : x)));
                    log(`Carry-forward rule ${v ? "enabled" : "disabled"}: ${r.label}`, "accent");
                    toast.success(v ? "Rule enabled" : "Rule disabled", { description: r.label });
                  }}
                />
              </div>
            ))}
            <div className="flex gap-2 rounded-xl bg-accent-soft p-3 text-[12.5px] text-accent">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              No silent carry-forward. Every unit that moves between cycles has an owner, a reason and a timestamp.
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!closing}
        onOpenChange={(o) => {
          if (!o) {
            setClosing(null);
            setAck(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Close {closing?.label} for {closing ? clientById(closing.clientId).name : ""}?
            </DialogTitle>
            <DialogDescription>This locks the period.</DialogDescription>
          </DialogHeader>
          {closing && (
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border p-3 text-center">
                <div>
                  <div className="text-[11px] text-muted-foreground">Delivered</div>
                  <div className="text-[17px] font-semibold tabular">
                    {closing.delivered}/{closing.promised}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Revenue</div>
                  <div className="text-[17px] font-semibold tabular">{inr(closing.revenue)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Margin</div>
                  <div className="text-[17px] font-semibold tabular">{pct((closing.revenue - closing.cost) / closing.revenue)}</div>
                </div>
              </div>
              {decisions[closing.id] && (
                <p className="text-[13px]">
                  Shortfall decision: <span className="font-medium">{decisionOptions(closing).find((o) => o.value === decisions[closing.id])?.label}</span>
                </p>
              )}
              <div className="space-y-1.5 rounded-xl bg-muted p-3.5 text-[12.5px] text-muted-foreground">
                <p className="flex gap-2">
                  <Lock className="mt-0.5 size-3.5 shrink-0" /> Delivered units, revenue, cost and margin for this period are frozen.
                </p>
                <p className="pl-5.5">
                  Closed periods are never silently recalculated. Late timesheets, expenses or credit notes post as dated adjustments in the next open period — with who and why.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
                <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />I understand this period will be locked
              </label>
            </DialogBody>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!ack} onClick={confirmClose}>
              <Lock /> Close & lock period
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
