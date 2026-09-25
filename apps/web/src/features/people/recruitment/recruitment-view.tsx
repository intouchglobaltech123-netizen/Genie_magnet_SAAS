"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Clock, FileText, KanbanSquare, MoreHorizontal, Star, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDemo } from "@/lib/store";
import { cn, inr } from "@/lib/utils";
import { evaluate, roles, seedCandidates, sourceTone, stageMeta, stages, type Candidate, type Scorecard, type Stage } from "./data";
import { RoleDocPanel } from "./role-doc";
import { ScorecardSheet } from "./scorecard-sheet";

const dotCls: Record<string, string> = {
  neutral: "bg-muted-foreground/50",
  info: "bg-info",
  accent: "bg-primary",
  warning: "bg-warning",
  gold: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
};

export function RecruitmentView() {
  const log = useDemo((s) => s.log);
  const [roleId, setRoleId] = useState(roles[0].id);
  const [candidates, setCandidates] = useState<Candidate[]>(seedCandidates);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sourcing, setSourcing] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(roles.map((r) => [r.id, r.sourcing])),
  );

  const role = roles.find((r) => r.id === roleId)!;
  const list = candidates.filter((c) => c.roleId === roleId);
  const open = candidates.find((c) => c.id === openId) ?? null;
  const active = candidates.filter((c) => c.stage !== "Joined" && c.stage !== "Rejected");
  const awaitingApproval = candidates.filter((c) => c.stage === "Approval");
  const referrals = candidates.filter((c) => c.source === "Employee referral").length;

  const move = (id: string, stage: Stage, note?: string) => {
    const c = candidates.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    setCandidates((cs) => cs.map((x) => (x.id === id ? { ...x, stage } : x)));
    const roleName = roles.find((r) => r.id === c.roleId)?.name;
    const tone = stage === "Rejected" ? "danger" : stage === "Joined" || stage === "Offer" ? "success" : "accent";
    log(`${c.name} (${roleName}) moved to ${stageMeta[stage].label}${note ? ` — ${note}` : ""}`, tone);
    const fn = stage === "Rejected" ? toast.error : stage === "Offer" || stage === "Joined" ? toast.success : toast;
    fn(`${c.name} → ${stageMeta[stage].label}`, {
      description:
        stage === "Approval"
          ? "Janarthanan will see this in his approvals inbox."
          : stage === "Offer"
            ? `Offer letter drafted at ${inr(c.expectedCtc)}/mo for Harini to send.`
            : stage === "Joined"
              ? "Onboarding checklist and 6-month probation timer started."
              : stage === "Rejected"
                ? "Regret email queued; candidate kept in talent pool."
                : note ?? `${roleName} pipeline updated.`,
    });
  };

  const saveScorecard = (id: string, sc: Scorecard) => setCandidates((cs) => cs.map((x) => (x.id === id ? { ...x, scorecard: sc } : x)));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Recruitment"
        description="Hire against a Role Task Document, score every candidate on the same competence model, and route the final call to the founder."
        depth="preview"
        className="mb-0"
        actions={
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              const n: Candidate = {
                id: `c-${Date.now().toString(36)}`,
                roleId,
                name: roleId === "r-editor" ? "Gowtham Selvaraj" : "Priyanka Natarajan",
                city: roleId === "r-editor" ? "Namakkal" : "Erode",
                source: "Employee referral",
                experience: roleId === "r-editor" ? "1 yr" : "2 yrs · FMCG",
                expectedCtc: roleId === "r-editor" ? 15000 : 15000,
                stage: "Lead",
                appliedOn: "2026-09-25",
                highlight: "Just added via referral form",
              };
              setCandidates((cs) => [n, ...cs]);
              log(`${n.name} added as a lead for ${role.name}`, "accent");
              toast.success(`${n.name} added to ${role.name}`, { description: "Placed in Lead / Candidate. Screening call to be scheduled." });
            }}
          >
            <UserPlus /> Add candidate
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open roles" value={roles.length} icon={Briefcase} hint="Video Editor · Sales Exec" tone="accent" />
        <StatCard label="Active candidates" value={active.length} icon={Users} hint={`${candidates.length} total applied`} tone="info" />
        <StatCard label="Awaiting founder" value={awaitingApproval.length} icon={Star} hint={awaitingApproval.map((c) => c.name.split(" ")[0]).join(", ") || "None"} tone="gold" />
        <StatCard label="Avg. time to hire" value="18 days" icon={Clock} delta={-0.22} deltaLabel="faster vs last hire" tone="success" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-card">
          {roles.map((r) => {
            const count = candidates.filter((c) => c.roleId === r.id && c.stage !== "Rejected").length;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoleId(r.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-body font-medium transition",
                  roleId === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.name}
                <span className={cn("rounded-md px-1.5 text-body tabular", roleId === r.id ? "bg-white/15" : "bg-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="text-body text-muted-foreground">
          Referrals make up <b className="text-foreground tabular">{Math.round((referrals / candidates.length) * 100)}%</b> of applicants
        </div>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">
            <KanbanSquare /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="rtd">
            <FileText /> Role Task Document
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-3">
            <div className="flex gap-3">
              {stages.map((st) => {
                const col = list.filter((c) => c.stage === st);
                const meta = stageMeta[st];
                return (
                  <div key={st} className="flex w-[264px] shrink-0 flex-col rounded-2xl border border-border bg-muted/40">
                    <div className="flex items-center justify-between px-3.5 py-3">
                      <div className="flex items-center gap-2 text-body font-semibold">
                        <span className={cn("size-2 rounded-full", dotCls[meta.tone])} />
                        {meta.label}
                      </div>
                      <span className="rounded-md bg-card px-1.5 text-body font-medium tabular text-muted-foreground">{col.length}</span>
                    </div>
                    <div className="flex min-h-40 flex-col gap-2.5 px-2.5 pb-2.5">
                      {col.map((c) => (
                        <CandidateCard key={c.id} c={c} onOpen={() => setOpenId(c.id)} onMove={move} />
                      ))}
                      {!col.length && (
                        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border py-8 text-body text-muted-foreground">
                          No candidates
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="rtd">
          <RoleDocPanel
            role={role}
            sourcing={sourcing[role.id]}
            onToggleSource={(s) => {
              const on = sourcing[role.id].includes(s);
              setSourcing((prev) => ({
                ...prev,
                [role.id]: on ? prev[role.id].filter((x) => x !== s) : [...prev[role.id], s],
              }));
              toast(on ? `${s} paused` : `${s} activated`, { description: `Sourcing for ${role.name} updated.` });
            }}
          />
        </TabsContent>
      </Tabs>

      <ScorecardSheet candidate={open} onOpenChange={(o) => !o && setOpenId(null)} onSave={saveScorecard} onMove={move} />
    </div>
  );
}

function CandidateCard({ c, onOpen, onMove }: { c: Candidate; onOpen: () => void; onMove: (id: string, s: Stage) => void }) {
  const idx = stages.indexOf(c.stage);
  const next = idx < stages.length - 2 ? stages[idx + 1] : null;
  const ev = c.scorecard ? evaluate(c.scorecard) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn(
        "group cursor-pointer rounded-xl border border-border bg-card p-3 shadow-card transition hover:border-primary/40",
        c.stage === "Rejected" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={c.name} size="sm" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-semibold">{c.name}</div>
          <div className="truncate text-body text-muted-foreground">
            {c.city} · {c.experience}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label="Move candidate"
              className="-mr-1 -mt-1 inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
            {stages.map((s) => (
              <DropdownMenuItem key={s} disabled={s === c.stage} onSelect={() => onMove(c.id, s)} className={s === "Rejected" ? "text-danger" : ""}>
                <span className={cn("size-2 rounded-full", dotCls[stageMeta[s].tone])} />
                {stageMeta[s].label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpen}>Open scorecard</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-2 line-clamp-2 text-body leading-snug text-muted-foreground">{c.highlight}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={sourceTone[c.source]}>{c.source}</Badge>
        <Badge tone="outline" className="tabular">
          {inr(c.expectedCtc)}/mo
        </Badge>
      </div>
      {(ev || next) && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
          {ev ? (
            <span className="text-body text-muted-foreground">
              <b className="font-semibold text-foreground tabular">{ev.total}/25</b> ·{" "}
              <span className={ev.rec === "Hire" ? "text-success" : ev.rec === "Hold" ? "text-warning" : "text-danger"}>{ev.rec}</span>
              {c.scorecard && !c.scorecard.submitted && " · draft"}
            </span>
          ) : (
            <span className="text-body text-muted-foreground">Not scored</span>
          )}
          {next && (
            <Button
              size="xs"
              variant="ghost"
              className="h-6 px-2 text-body"
              onClick={(e) => {
                e.stopPropagation();
                onMove(c.id, next);
              }}
            >
              {stageMeta[next].label.split(" ")[0]} <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
