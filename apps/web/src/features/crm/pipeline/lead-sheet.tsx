"use client";

import { useState } from "react";
import { CheckCircle2, FileText, Handshake, Mail, MessageSquare, Phone, ShieldAlert, Trophy, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { personById } from "@/lib/mock/core";
import { LEAD_STAGES, leadTimeline, proposalVersions, scoreBreakdown, stageProbability } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { cn, fmtDate, inr } from "@/lib/utils";
import { SALES_AUTHORITY, useCrmDemo } from "@/features/crm/crm-store";
import { ScoreRing, sourceTone } from "./lead-card";

const kindIcon = { system: Users, call: Phone, meeting: Handshake, doc: FileText, win: Trophy, loss: XCircle };

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-t border-border py-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
        {right}
      </div>
      {children}
    </section>
  );
}

export function LeadSheet({ leadId, onClose, onMove }: { leadId: string | null; onClose: () => void; onMove: (id: string, s: Lead["stage"]) => void }) {
  const lead = useDemo((s) => s.leads.find((l) => l.id === leadId));
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right">{lead && <LeadDetail key={lead.id} lead={lead} onMove={onMove} />}</DialogContent>
    </Dialog>
  );
}

function LeadDetail({ lead, onMove }: { lead: Lead; onMove: (id: string, s: Lead["stage"]) => void }) {
  const role = useDemo((s) => s.role);
  const log = useDemo((s) => s.log);
  const { discounts, requestDiscount, decideDiscount } = useCrmDemo();
  const disc = discounts[lead.id];
  const [pctIn, setPctIn] = useState(disc ? String(disc.pct) : "");
  const [reason, setReason] = useState(disc?.reason ?? "");
  const owner = personById(lead.ownerId);
  const breakdown = scoreBreakdown(lead);
  const proposals = proposalVersions(lead);
  const pctNum = Number(pctIn) || 0;
  const needsFounder = pctNum > SALES_AUTHORITY;

  return (
    <>
      <DialogHeader className="pb-5">
        <div className="flex items-center gap-2">
          <Badge tone={sourceTone[lead.source]}>{lead.source}</Badge>
          <Badge tone="outline">{lead.service}</Badge>
        </div>
        <DialogTitle className="pt-2 text-xl">{lead.company}</DialogTitle>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
          <span>{lead.name}</span>
          <span className="inline-flex items-center gap-1">
            <Phone className="size-3.5" /> {lead.phone}
          </span>
          <span className="inline-flex items-center gap-1">
            <Mail className="size-3.5" /> {lead.email}
          </span>
        </div>
      </DialogHeader>
      <DialogBody className="pb-8">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">Value / month</div>
            <div className="mt-1 text-[16px] font-semibold tabular">{inr(lead.value)}</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">Win probability</div>
            <div className="mt-1 text-[16px] font-semibold tabular">{Math.round(stageProbability[lead.stage] * 100)}%</div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="text-[11px] text-muted-foreground">Owner</div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] font-medium">
              <Avatar name={owner.name} size="xs" /> <span className="truncate">{owner.name.split(" ")[0]}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-[12.5px] text-muted-foreground">Stage</span>
          <Select className="h-8 w-44" value={lead.stage} onValueChange={(v) => onMove(lead.id, v as Lead["stage"])} options={LEAD_STAGES.map((s) => ({ value: s, label: s }))} />
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => toast.success("WhatsApp template sent", { description: `Follow-up to ${lead.name} logged` })}>
            <MessageSquare /> Follow up
          </Button>
        </div>
        {lead.notes && <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-[12.5px]">{lead.notes}</div>}

        <div className="mt-5" />
        <Section title="Qualification score" right={<ScoreRing score={lead.score} size={34} />}>
          <div className="space-y-2.5">
            {breakdown.map((b) => (
              <div key={b.label} className="grid grid-cols-[140px_1fr_44px] items-center gap-3 text-[12.5px]">
                <span className="text-muted-foreground">{b.label}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(b.value / b.max) * 100}%` }} />
                </div>
                <span className="text-right tabular">
                  {b.value}
                  <span className="text-muted-foreground">/{b.max}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Proposals">
          {proposals.length ? (
            <div className="space-y-2">
              {proposals.map((p) => (
                <div key={p.label} className={cn("flex items-center gap-3 rounded-xl border border-border p-3", p.status === "superseded" && "opacity-60")}>
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-[12px] font-semibold">{p.label}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{p.note}</div>
                    <div className="text-[12px] text-muted-foreground">{p.scope}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-[13px] font-semibold tabular", p.status === "superseded" && "line-through")}>{inr(p.price)}</div>
                    <Badge tone={p.status === "accepted" ? "success" : p.status === "sent" ? "info" : "neutral"}>{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
              No proposal yet — sent after discovery.
              <Button size="xs" variant="soft" onClick={() => toast.success("Proposal draft created from package template")}>
                Draft proposal
              </Button>
            </div>
          )}
        </Section>

        {!["Won", "Lost"].includes(lead.stage) && (
          <Section title="Discount request" right={<span className="text-[11.5px] text-muted-foreground">Sales authority up to {SALES_AUTHORITY}%</span>}>
            {disc && disc.status !== "auto-approved" ? (
              <div
                className={cn(
                  "rounded-xl border p-3.5",
                  disc.status === "pending" ? "border-warning/40 bg-warning-soft" : disc.status === "approved" ? "border-success/40 bg-success-soft" : "border-danger/30 bg-danger-soft",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {disc.status === "pending" ? <ShieldAlert className="mt-0.5 size-4 text-warning" /> : disc.status === "approved" ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-danger" />}
                  <div className="flex-1 text-[12.5px]">
                    <div className="font-semibold text-foreground">
                      {disc.pct}% discount · {disc.status === "pending" ? "Needs founder approval" : disc.status === "approved" ? "Approved by Janarthanan" : "Rejected — counter at 8%"}
                    </div>
                    <div className="text-muted-foreground">
                      {disc.reason} · Net {inr(lead.value * (1 - disc.pct / 100))}/mo (−{inr((lead.value * disc.pct) / 100)})
                    </div>
                  </div>
                </div>
                {disc.status === "pending" && (
                  <div className="mt-3 flex justify-end gap-2">
                    <Tooltip content={role === "founder" ? "You have founder authority" : "Only the founder can approve above 10%"}>
                      <span>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={role !== "founder"}
                          onClick={() => {
                            decideDiscount(lead.id, false);
                            log(`Janarthanan rejected ${disc.pct}% discount for ${lead.company}`, "warning");
                            toast("Discount rejected");
                          }}
                        >
                          Reject
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      size="xs"
                      variant="success"
                      disabled={role !== "founder"}
                      onClick={() => {
                        decideDiscount(lead.id, true);
                        log(`Janarthanan approved ${disc.pct}% discount for ${lead.company}`, "success");
                        toast.success("Discount approved", { description: "Sales can send the revised proposal" });
                      }}
                    >
                      <CheckCircle2 /> Approve
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative w-28">
                    <Input type="number" value={pctIn} onChange={(e) => setPctIn(e.target.value)} placeholder="12" className="pr-7" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
                  </div>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. competing quote)" />
                </div>
                {pctNum > 0 && (
                  <div className={cn("text-[12px]", needsFounder ? "text-warning" : "text-success")}>
                    {needsFounder ? `Above ${SALES_AUTHORITY}% — will route to Janarthanan for approval` : "Within sales authority — auto-approved"} · net{" "}
                    {inr(lead.value * (1 - pctNum / 100))}/mo
                  </div>
                )}
                {disc?.status === "auto-approved" && <Badge tone="success">{disc.pct}% applied within authority</Badge>}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={!pctNum}
                    onClick={() => {
                      const r = requestDiscount(lead.id, pctNum, reason || "Price objection");
                      if (r.status === "pending") {
                        log(`${lead.company} requested ${pctNum}% discount — needs founder approval`, "warning");
                        toast.warning("Sent for founder approval", { description: `${pctNum}% exceeds sales authority of ${SALES_AUTHORITY}%` });
                      } else toast.success(`${pctNum}% discount applied`);
                    }}
                  >
                    Request discount
                  </Button>
                </div>
              </div>
            )}
          </Section>
        )}

        <Section title="Activity">
          <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
            {leadTimeline(lead).map((t, i) => {
              const Icon = kindIcon[t.kind];
              return (
                <li key={i} className="relative flex gap-3">
                  <span
                    className={cn(
                      "relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-card",
                      t.kind === "win" && "border-success/40 bg-success-soft text-success",
                      t.kind === "loss" && "border-danger/40 bg-danger-soft text-danger",
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="pt-0.5">
                    <div className="text-[13px]">{t.text}</div>
                    <div className="text-[11.5px] text-muted-foreground">{t.at}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 text-[11.5px] text-muted-foreground">Created {fmtDate(lead.createdAt, { day: "numeric", month: "short", year: "numeric" })}</div>
        </Section>
      </DialogBody>
    </>
  );
}
