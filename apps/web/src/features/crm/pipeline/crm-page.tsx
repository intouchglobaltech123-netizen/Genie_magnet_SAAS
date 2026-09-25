"use client";

import { useState } from "react";
import { BarChart3, Kanban, Plus, Search, Target, TrendingUp, Trophy, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEAD_STAGES, sourceHistory, stageProbability } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { cn, inrCompact, pct } from "@/lib/utils";
import { useCrmDemo } from "@/features/crm/crm-store";
import { ConvertDialog, ConvertedNote } from "./convert-dialog";
import { LeadCard } from "./lead-card";
import { LeadSheet } from "./lead-sheet";
import { NewLeadDialog } from "./new-lead-dialog";
import { SourceTable } from "./source-table";

const stageDot: Record<Lead["stage"], string> = {
  New: "bg-chart-5",
  Contacted: "bg-info",
  Qualified: "bg-primary",
  Discovery: "bg-primary",
  Proposal: "bg-accent",
  Negotiation: "bg-warning",
  Won: "bg-success",
  Lost: "bg-danger",
};

export function CrmPage() {
  const leads = useDemo((s) => s.leads);
  const moveLead = useDemo((s) => s.moveLead);
  const { discounts, converted } = useCrmDemo();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [winLead, setWinLead] = useState<Lead | null>(null);
  const [over, setOver] = useState<Lead["stage"] | null>(null);
  const [q, setQ] = useState("");

  const move = (id: string, stage: Lead["stage"]) => {
    const l = leads.find((x) => x.id === id);
    if (!l || l.stage === stage) return;
    moveLead(id, stage);
    if (stage === "Won") {
      setOpenId(null);
      setWinLead({ ...l, stage });
    } else if (stage === "Lost") toast(`${l.company} marked lost`, { description: "Reason captured · auto-reminder to reopen in 90 days" });
    else toast.success(`${l.company} → ${stage}`);
  };

  const open = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  const pipeline = open.reduce((s, l) => s + l.value, 0);
  const weighted = open.reduce((s, l) => s + l.value * stageProbability[l.stage], 0);
  const hist = Object.values(sourceHistory);
  const totalLeads = hist.reduce((s, h) => s + h.leads, 0) + leads.length;
  const won = hist.reduce((s, h) => s + h.won, 0) + leads.filter((l) => l.stage === "Won").length;
  const wonRev = hist.reduce((s, h) => s + h.revenue, 0) + leads.filter((l) => l.stage === "Won").reduce((s, l) => s + l.value, 0);

  const filtered = q ? leads.filter((l) => `${l.company} ${l.name} ${l.source} ${l.service}`.toLowerCase().includes(q.toLowerCase())) : leads;

  return (
    <div>
      <PageHeader
        eyebrow="Module 9 · CRM & Sales"
        title="Sales pipeline"
        description="Every enquiry from Meta, WhatsApp, referrals and BNI in one place — with owners, follow-ups and discount control."
        actions={
          <Button variant="accent" size="sm" onClick={() => setNewOpen(true)}>
            <Plus /> New lead
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open pipeline" value={inrCompact(pipeline)} icon={Wallet} tone="accent" hint={`${open.length} deals · per month`} />
        <StatCard label="Weighted forecast" value={inrCompact(weighted)} icon={TrendingUp} tone="info" hint="by stage probability" />
        <StatCard label="Conversion rate" value={pct(won / totalLeads, 1)} icon={Target} tone="gold" hint={`${won} won of ${totalLeads} leads`} />
        <StatCard label="Avg deal size" value={inrCompact(wonRev / won)} icon={Trophy} tone="success" hint="monthly retainer" />
      </div>

      <Tabs defaultValue="board">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="board">
              <Kanban /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="sources">
              <BarChart3 /> Sources
            </TabsTrigger>
          </TabsList>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter leads" className="h-8 pl-9" />
          </div>
        </div>

        <TabsContent value="board">
          <div className="-mx-4 overflow-x-auto px-4 pb-4 scrollbar-thin lg:-mx-8 lg:px-8">
            <div className="flex min-w-max gap-3">
              {LEAD_STAGES.map((stage) => {
                const col = filtered.filter((l) => l.stage === stage);
                const total = col.reduce((s, l) => s + l.value, 0);
                return (
                  <div
                    key={stage}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (over !== stage) setOver(stage);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOver(null);
                      const id = e.dataTransfer.getData("text/lead");
                      if (id) move(id, stage);
                    }}
                    className={cn(
                      "flex w-[272px] shrink-0 flex-col rounded-2xl border bg-muted/40 p-2 transition",
                      over === stage ? "border-primary bg-primary-soft/60" : "border-transparent",
                    )}
                  >
                    <div className="flex items-center justify-between px-2 pb-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", stageDot[stage])} />
                        <span className="text-body font-semibold">{stage}</span>
                        <span className="rounded-md bg-card px-1.5 text-body font-medium text-muted-foreground tabular">{col.length}</span>
                      </div>
                      <span className="text-body font-medium text-muted-foreground tabular">{inrCompact(total)}</span>
                    </div>
                    <div className="flex min-h-24 flex-1 flex-col gap-2">
                      {col.map((l) => (
                        <div key={l.id}>
                          <LeadCard
                            lead={l}
                            onOpen={() => setOpenId(l.id)}
                            onMove={(s) => move(l.id, s)}
                            discountPending={discounts[l.id]?.status === "pending"}
                          />
                          {l.stage === "Won" && (converted.includes(l.id) || l.id === "l-10") && (
                            <div className="px-2 pt-1">
                              <ConvertedNote />
                            </div>
                          )}
                          {l.stage === "Won" && !converted.includes(l.id) && l.id !== "l-10" && (
                            <button onClick={() => setWinLead(l)} className="cursor-pointer px-2 pt-1 text-body font-medium text-primary hover:underline">
                              Convert to agreement →
                            </button>
                          )}
                        </div>
                      ))}
                      {!col.length && (
                        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border py-6 text-body text-muted-foreground">
                          Drop here
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="sources">
          <SourceTable />
        </TabsContent>
      </Tabs>

      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} />
      <LeadSheet leadId={openId} onClose={() => setOpenId(null)} onMove={move} />
      <ConvertDialog lead={winLead} onClose={() => setWinLead(null)} />
    </div>
  );
}
