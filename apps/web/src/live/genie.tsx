"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, EyeOff, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { GENIE_RULE_KEYS, GENIE_RULES, type GenieRuleKey, type GenieRuleSetting, type InsightRow, type InsightStatus } from "@gm/shared";
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
import { useCan, useGenieSettings, useInsightDecision, useInsights, useRunGenie, useSaveGenieSettings } from "./queries";

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
  const decide = useInsightDecision();
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
    </li>
  );
}

const TABS: { key: InsightStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "dismissed", label: "Dismissed" },
  { key: "resolved", label: "Cleared by itself" },
];

/** /app/genie: what Genie Assistant's rules found that this person may see (P4-04). */
export function LiveGenie() {
  const [status, setStatus] = useState<InsightStatus>("open");
  const [rule, setRule] = useState<GenieRuleKey | "">("");
  const [mine, setMine] = useState(false);
  const list = useInsights({ status, rule, mine });
  const run = useRunGenie();
  const settings = useGenieSettings();
  return (
    <>
      <PageHeader
        title="Genie Assistant"
        description="What has slipped — videos stuck in a step, clients waiting, quotas behind, invoices overdue — found each morning from your own data, for whoever should act."
        actions={
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
        }
      />
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
        <Card className="p-5">
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
      )}
    </>
  );
}
