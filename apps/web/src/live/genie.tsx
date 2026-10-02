"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, EyeOff, MessageCircle, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  DRAFT_KIND_LABEL,
  GENIE_RULE_KEYS,
  GENIE_RULES,
  type GenieRuleKey,
  type GenieRuleSetting,
  type GenieSettings,
  type InsightRow,
  type InsightStatus,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { AskGenie } from "./ask-genie";
import { DraftDialog } from "./genie-drafts";
import {
  useAiUsage,
  useCan,
  useEvaluate,
  useGenieSettings,
  useInsightDecision,
  useInsights,
  useRunGenie,
  useSaveAiSettings,
  useSaveGenieSettings,
} from "./queries";

const SEVERITY: Record<InsightRow["severity"], { label: string; tone: "danger" | "warning" | "info"; bar: string }> = {
  critical: { label: "Urgent", tone: "danger", bar: "border-l-danger" },
  warning: { label: "Needs a look", tone: "warning", bar: "border-l-warning" },
  info: { label: "For your information", tone: "info", bar: "border-l-info" },
};

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

function InsightCard({ i, compact = false }: { i: InsightRow; compact?: boolean }) {
  const can = useCan();
  const decide = useInsightDecision();
  const [nudging, setNudging] = useState(false);
  const act = (status: "done" | "dismissed" | "open", message: string) =>
    decide.mutate({ id: i.id, status }, { onSuccess: () => toast.success(message), onError: (e) => toast.error(errorMessage(e)) });
  const s = SEVERITY[i.severity];
  return (
    <li className={cn("rounded-xl border border-l-4 border-border bg-card p-4", s.bar)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.tone}>{s.label}</Badge>
            <span className="text-body text-muted-foreground">{GENIE_RULES[i.rule].label}</span>
          </div>
          <p className="mt-1 font-medium">{i.title}</p>
          {i.body && !compact && <p className="text-body text-text-secondary">{i.body}</p>}
          <p className="mt-1 text-body text-muted-foreground">
            {[i.client?.name, i.owner?.name && `for ${i.owner.name}`, `first seen ${ago(i.firstSeenAt)}`].filter(Boolean).join(" · ")}
            {i.status === "resolved" && i.resolvedAt && ` · cleared ${ago(i.resolvedAt)}`}
          </p>
        </div>
        <span className="flex flex-wrap gap-1.5">
          {i.link && (
            <Button size="xs" variant="secondary" asChild>
              <Link href={i.link}>
                Open
                <ArrowRight />
              </Link>
            </Button>
          )}
          {i.status === "open" && can("clients", "edit") && (
            <Button size="xs" variant="secondary" onClick={() => setNudging(true)}>
              <MessageCircle />
              Draft a nudge
            </Button>
          )}
          {i.status === "open" ? (
            <>
              <Button size="xs" variant="ghost" disabled={decide.isPending} onClick={() => act("done", "Marked done")}>
                <Check />
                Done
              </Button>
              <Button size="xs" variant="ghost" disabled={decide.isPending} onClick={() => act("dismissed", "Dismissed — it stays hidden while it lasts")}>
                <EyeOff />
                Dismiss
              </Button>
            </>
          ) : (
            i.status !== "resolved" && (
              <Button size="xs" variant="ghost" disabled={decide.isPending} onClick={() => act("open", "Opened again")}>
                <RotateCcw />
                Open again
              </Button>
            )
          )}
        </span>
      </div>
      {nudging && (
        <DraftDialog
          request={{ kind: "nudge", insightId: i.id }}
          title="A WhatsApp nudge"
          description={`About: ${i.title}. Check it, edit it, then approve to open it in WhatsApp — nothing is sent until you send it there.`}
          onClose={() => setNudging(false)}
          onApproved={() => decide.mutate({ id: i.id, status: "done" })}
        />
      )}
    </li>
  );
}

const TABS: { key: InsightStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "dismissed", label: "Dismissed" },
  { key: "resolved", label: "Cleared by itself" },
];

/** /app/genie: what has slipped (P4-04), and Ask Genie (P4-08). */
export function LiveGenie() {
  const [view, setView] = useState<"insights" | "ask">("insights");
  return (
    <>
      <PageHeader
        title="Genie Assistant"
        description="What has slipped — videos stuck in a step, clients waiting, quotas behind, invoices overdue — found each morning from your own data, for whoever should act. And questions about your agency, answered from what you may see."
        actions={view === "insights" ? <LookAgain /> : undefined}
      />
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-4">
        <TabsList>
          <TabsTrigger value="insights">What has slipped</TabsTrigger>
          <TabsTrigger value="ask">Ask Genie</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "insights" ? <Insights /> : <AskGenie />}
    </>
  );
}

function LookAgain() {
  const run = useRunGenie();
  return (
    <Button
      variant="secondary"
      disabled={run.isPending}
      onClick={() =>
        run.mutate(undefined, {
          onSuccess: (r) => toast.success(r.raised ? `${r.raised} new` : "Nothing new"),
          onError: (e) => toast.error(errorMessage(e)),
        })
      }
    >
      <RefreshCw className={cn(run.isPending && "animate-spin")} />
      Look again now
    </Button>
  );
}

function Insights() {
  const [status, setStatus] = useState<InsightStatus>("open");
  const [rule, setRule] = useState<GenieRuleKey | "">("");
  const [mine, setMine] = useState(false);
  const list = useInsights({ status, rule, mine });
  const settings = useGenieSettings();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as InsightStatus)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="w-56">
          <Select
            aria-label="Rule"
            value={rule || "_all"}
            onValueChange={(v) => setRule(v === "_all" ? "" : (v as GenieRuleKey))}
            options={[{ value: "_all", label: "Every rule" }, ...GENIE_RULE_KEYS.map((k) => ({ value: k, label: GENIE_RULES[k].label }))]}
          />
        </div>
        <label className="flex items-center gap-2 text-body">
          <Checkbox checked={mine} onCheckedChange={(v) => setMine(v === true)} />
          Mine only
        </label>
        {settings.data?.lastRunAt && (
          <span className="ml-auto text-body text-muted-foreground">
            Last looked {new Date(settings.data.lastRunAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
          </span>
        )}
      </div>
      {list.isPending ? (
        <SkeletonRows rows={5} />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : !list.data.length ? (
        <EmptyState
          icon={Sparkles}
          title={status === "open" ? "Nothing has slipped" : "Nothing here"}
          description={status === "open" ? "Genie Assistant looks every morning; anything that needs you shows here and in your notifications." : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {list.data.map((i) => (
            <InsightCard key={i.id} i={i} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Home: the most pressing open insights for this person. */
export function GenieHomeCard() {
  const list = useInsights({ status: "open" });
  if (!list.data?.length) return null;
  return (
    <SectionCard
      title="Genie Assistant"
      description={`${list.data.length === 1 ? "1 thing needs" : `${list.data.length} things need`} a look.`}
      actions={
        <Button size="sm" variant="ghost" asChild>
          <Link href="/app/genie">
            See all
            <ArrowRight />
          </Link>
        </Button>
      }
    >
      <ul className="space-y-2">
        {list.data.slice(0, 4).map((i) => (
          <InsightCard key={i.id} i={i} compact />
        ))}
      </ul>
    </SectionCard>
  );
}

function RuleRow({
  k,
  value,
  onChange,
  disabled,
  error,
}: {
  k: GenieRuleKey;
  value: GenieRuleSetting;
  onChange: (v: GenieRuleSetting) => void;
  disabled: boolean;
  error?: string;
}) {
  const r = GENIE_RULES[k];
  return (
    <li className="grid gap-3 py-3 sm:grid-cols-[auto_1fr_220px] sm:items-center">
      <Switch checked={value.enabled} disabled={disabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} aria-label={`${r.label} on`} />
      <div>
        <div className="font-medium">{r.label}</div>
        <div className="text-body text-muted-foreground">{r.description}</div>
      </div>
      <label className="flex items-center gap-2 text-body">
        <span className="text-muted-foreground">{r.threshold.label}</span>
        <Input
          type="number"
          className="w-20"
          min={r.threshold.min}
          max={r.threshold.max}
          disabled={disabled || !value.enabled}
          value={value.threshold}
          onChange={(e) => onChange({ ...value, threshold: Number(e.target.value) })}
        />
      </label>
      {error && <p className="text-body text-danger sm:col-start-2">{error}</p>}
    </li>
  );
}

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const SOURCE: Record<GenieSettings["ai"]["source"], string> = {
  claude: "Drafts are written by Claude, on Genie Magnet OS's own Anthropic account.",
  "stand-in": "On this server the model is not switched on: drafts are made up by a stand-in so every step can be tried.",
  off: "Drafting is not switched on for this server yet.",
};

/** Drafting on or off, the monthly budget and how long prompts are kept (P4-05, P4-09, P4-10). */
function AiCard({ s, canEdit }: { s: GenieSettings; canEdit: boolean }) {
  const save = useSaveAiSettings();
  const [f, setF] = useState({ budget: String(s.ai.monthlyBudget), retention: String(s.ai.retentionDays) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const onError = (e: unknown) =>
    e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e));
  const pct = s.ai.monthlyBudget ? Math.min(100, Math.round((s.ai.spentThisMonth / s.ai.monthlyBudget) * 100)) : 100;
  return (
    <SectionCard
      title="Drafts and Ask Genie"
      description="Genie Assistant can draft WhatsApp nudges, captions, content ideas and report summaries for your team to approve. It uses AI, which counts against your monthly budget."
      actions={
        <label className="flex items-center gap-2 text-body">
          <Switch
            checked={s.ai.enabled}
            disabled={!canEdit || save.isPending}
            onCheckedChange={(aiEnabled) =>
              save.mutate({ aiEnabled }, { onSuccess: () => toast.success(aiEnabled ? "Drafting is on" : "Drafting is off"), onError })
            }
            aria-label="Drafting on"
          />
          {s.ai.enabled ? "On" : "Off"}
        </label>
      }
    >
      <Alert tone={s.ai.source === "off" ? "warning" : "info"} className="mb-4">
        {SOURCE[s.ai.source]}
      </Alert>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <div className="text-body text-muted-foreground">Used this month</div>
          <div className="text-lg font-semibold">
            {inr(s.ai.spentThisMonth)} <span className="text-body font-normal text-muted-foreground">of {inr(s.ai.monthlyBudget)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className={cn("h-1.5 rounded-full", pct >= 90 ? "bg-danger" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <label className="text-body">
          <span className="text-muted-foreground">Monthly budget (₹)</span>
          <Input type="number" min={0} disabled={!canEdit} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
          {errors.monthlyBudget && <span className="text-danger">{errors.monthlyBudget}</span>}
        </label>
        <label className="text-body">
          <span className="text-muted-foreground">Keep what was sent to the AI for (days)</span>
          <Input type="number" min={7} max={730} disabled={!canEdit} value={f.retention} onChange={(e) => setF({ ...f, retention: e.target.value })} />
          {errors.retentionDays && <span className="text-danger">{errors.retentionDays}</span>}
        </label>
      </div>
      {canEdit && (
        <Button
          className="mt-4"
          variant="secondary"
          disabled={save.isPending || (f.budget === String(s.ai.monthlyBudget) && f.retention === String(s.ai.retentionDays))}
          onClick={() =>
            save.mutate(
              { monthlyBudget: Number(f.budget), retentionDays: Number(f.retention) },
              { onSuccess: () => (setErrors({}), toast.success("Saved")), onError },
            )
          }
        >
          Save
        </Button>
      )}
    </SectionCard>
  );
}

/** The owner's usage view: this month by feature and person, and how drafts were decided (P4-09, P4-11). */
function UsageCard() {
  const u = useAiUsage();
  if (!u.data || !u.data.calls) return null;
  const decided = u.data.drafts.approved + u.data.drafts.edited + u.data.drafts.rejected;
  const rate = decided ? Math.round(((u.data.drafts.approved + u.data.drafts.edited) / decided) * 100) : null;
  return (
    <SectionCard
      title="AI usage this month"
      description={`${u.data.calls} ${u.data.calls === 1 ? "call" : "calls"} · ${inr(u.data.spent)} of ${inr(u.data.budget)}`}
    >
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <div className="mb-1 font-medium">By feature</div>
          <ul className="space-y-1 text-body">
            {u.data.byFeature.map((f) => (
              <li key={f.feature} className="flex justify-between gap-2">
                <span>{f.feature === "ask" ? "Ask Genie" : (DRAFT_KIND_LABEL[f.feature as keyof typeof DRAFT_KIND_LABEL] ?? f.feature)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {f.calls} · {inr(f.spent)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 font-medium">By person</div>
          <ul className="space-y-1 text-body">
            {u.data.byPerson.map((p, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{p.name ?? "—"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {p.calls} · {inr(p.spent)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 font-medium">Drafts decided</div>
          <ul className="space-y-1 text-body">
            <li className="flex justify-between">
              <span>Approved as written</span>
              <span className="tabular-nums">{u.data.drafts.approved}</span>
            </li>
            <li className="flex justify-between">
              <span>Approved with edits</span>
              <span className="tabular-nums">{u.data.drafts.edited}</span>
            </li>
            <li className="flex justify-between">
              <span>Rejected</span>
              <span className="tabular-nums">{u.data.drafts.rejected}</span>
            </li>
            {rate !== null && (
              <li className="flex justify-between border-t border-border-subtle pt-1 font-medium">
                <span>Approval rate</span>
                <span className={cn("tabular-nums", rate < u.data.target && "text-warning")}>{rate}%</span>
              </li>
            )}
            {u.data.byKind.map((k) => (
              <li key={k.kind} className="flex justify-between text-muted-foreground">
                <span>{DRAFT_KIND_LABEL[k.kind]}</span>
                <span className={cn("tabular-nums", k.rate < u.data!.target && "text-warning")}>
                  {k.approved} of {k.decided} · {k.rate}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-body text-muted-foreground">The aim is {u.data.target}% or more approved.</p>
        </div>
      </div>
    </SectionCard>
  );
}

/** How close drafts come to what the team approved: captions for posts already published (P4-11). */
function EvaluationCard() {
  const run = useEvaluate();
  const e = run.data;
  return (
    <SectionCard
      title="How well drafts match your voice"
      description="Genie Assistant drafts captions for your latest published posts — without seeing their own captions — and compares them with the captions your team approved. It uses a little of the AI budget."
      actions={
        <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.mutate(5, { onError: (err) => toast.error(errorMessage(err)) })}>
          <Sparkles />
          {run.isPending ? "Checking…" : "Check 5 captions"}
        </Button>
      }
    >
      {!e ? (
        <p className="text-body text-muted-foreground">Run it after changing your brand voice in onboarding, or now and then to see drafts improving.</p>
      ) : !e.items.length ? (
        <p className="text-body text-muted-foreground">There are no published posts with captions to compare with yet.</p>
      ) : (
        <div className="space-y-3">
          <p className="font-medium">
            On average the drafts had {e.averageMatch}% of the approved wording.
            {e.source === "stand-in" && <span className="font-normal text-muted-foreground"> (Drafts here come from the stand-in, not the model.)</span>}
          </p>
          <ul className="space-y-2">
            {e.items.map((i) => (
              <li key={i.code} className="rounded-lg border border-border p-3 text-body">
                <div className="flex justify-between gap-2 font-medium">
                  <span>
                    {i.code} · {i.title} <span className="font-normal text-muted-foreground">({i.client})</span>
                  </span>
                  <span className="tabular-nums">{i.match}%</span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground">Approved</div>
                    <p className="whitespace-pre-line">{i.approved}</p>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Drafted</div>
                    <p className="whitespace-pre-line">{i.draft}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

/** Settings → Genie Assistant: which rules run, and their thresholds (P4-01). */
export function LiveGenieSettings() {
  const can = useCan();
  const settings = useGenieSettings();
  const save = useSaveGenieSettings();
  const [draft, setDraft] = useState<Record<GenieRuleKey, GenieRuleSetting> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = can("settings", "edit");
  const rules = draft ?? settings.data?.rules;
  return (
    <>
      <PageHeader
        title="Genie Assistant"
        description="The rules Genie Assistant uses to find what has slipped. Each runs every morning on your own data; switch off what you do not need and set the thresholds that fit how you work."
      />
      {settings.isPending ? (
        <SkeletonRows rows={8} />
      ) : settings.error ? (
        <Alert tone="danger">{errorMessage(settings.error)}</Alert>
      ) : (
        <div className="space-y-4">
          <AiCard key={`${settings.data.ai.monthlyBudget}:${settings.data.ai.retentionDays}`} s={settings.data} canEdit={canEdit} />
          {canEdit && <UsageCard />}
          {canEdit && settings.data.ai.enabled && <EvaluationCard />}
          <Card className="p-5">
            <h2 className="mb-1 font-semibold">Rules</h2>
            <ul className="divide-y divide-border-subtle">
              {GENIE_RULE_KEYS.map((k) => (
                <RuleRow
                  key={k}
                  k={k}
                  value={rules![k]}
                  disabled={!canEdit}
                  error={errors[`rules.${k}.threshold`]}
                  onChange={(v) => setDraft({ ...rules!, [k]: v })}
                />
              ))}
            </ul>
            {canEdit && (
              <div className="mt-4 flex gap-2">
                <Button
                  disabled={!draft || save.isPending}
                  onClick={() =>
                    save.mutate(
                      { rules: draft! },
                      {
                        onSuccess: () => (setDraft(null), setErrors({}), toast.success("Saved — the next look uses these")),
                        onError: (e) =>
                          e instanceof ApiError && e.body.issues
                            ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message])))
                            : toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  Save
                </Button>
                {draft && (
                  <Button variant="ghost" onClick={() => (setDraft(null), setErrors({}))}>
                    Undo changes
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
