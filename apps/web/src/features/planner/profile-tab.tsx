"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlarmClock, Check, ChevronDown, Droplets, Brain, Info, Sunrise, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { PROFILE_BANDS, RAW_MAX, RAW_MIN, scoreDiagnostic } from "@/features/planner/calc";
import { usePlanner } from "@/features/planner/store";
import { IntensityChip } from "@/features/planner/ui";
import { detoxDays, diagnosticGroups, WTF_TOOL } from "@/lib/mock/planner";
import { cn } from "@/lib/utils";

type Row = ReturnType<typeof scoreDiagnostic>["rows"][number];

function ScoreDial({ score }: { score: number }) {
  const r = 84;
  const c = Math.PI * r; // half circle
  const pctv = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className="relative mx-auto h-[120px] w-[220px]">
      <svg viewBox="0 0 200 110" className="h-full w-full">
        <defs>
          <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--danger)" />
            <stop offset="40%" stopColor="var(--warning)" />
            <stop offset="70%" stopColor="var(--chart-2)" />
            <stop offset="100%" stopColor="var(--success)" />
          </linearGradient>
        </defs>
        <path d="M 16 100 A 84 84 0 0 1 184 100" fill="none" stroke="var(--muted)" strokeWidth="14" strokeLinecap="round" />
        <motion.path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke="url(#dialGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pctv) }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <div className="text-[40px] font-semibold leading-none tracking-tight tabular">{score.toFixed(1)}</div>
        <div className="mt-1 text-[11.5px] text-muted-foreground">out of 100</div>
      </div>
    </div>
  );
}

function GroupList({ rows, title, desc, icon: Icon }: { rows: Row[]; title: string; desc: string; icon: typeof Brain }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" /> {title}
          </CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 px-3">
        {rows.map((g) => {
          const isOpen = open === g.key;
          const tone = g.intensity === "HIGH" ? "bg-danger" : g.intensity === "MEDIUM" ? "bg-warning" : "bg-success";
          return (
            <div key={g.key} className={cn("rounded-xl transition", isOpen && "bg-muted/60")}>
              <button onClick={() => setOpen(isOpen ? null : g.key)} className="grid w-full cursor-pointer grid-cols-[150px_1fr_44px_84px_16px] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/60">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{g.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{g.subtitle}</div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div className={cn("h-full rounded-full", tone)} initial={{ width: 0 }} animate={{ width: `${(g.score / 15) * 100}%` }} transition={{ duration: 0.6 }} />
                </div>
                <div className="text-right text-[13px] font-semibold tabular">
                  {g.score}
                  <span className="text-[11px] font-normal text-muted-foreground">/15</span>
                </div>
                <Tooltip content={`Weighted ${g.weighted} (score × ${g.weight}). HIGH ≥ 36 · MEDIUM ≥ 21 — as in the workbook`}>
                  <span>
                    <IntensityChip intensity={g.intensity} />
                  </span>
                </Tooltip>
                <ChevronDown className={cn("size-4 text-muted-foreground transition", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="grid gap-3 px-3 pb-3 pt-1 text-[12.5px] md:grid-cols-[1fr_1fr]">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">What this means</div>
                    <p className="mt-1">{g.meaning}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Action <Badge tone="accent">{g.dayToFix}</Badge>
                    </div>
                    <p className="mt-1">{g.action}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ProfileTab({ onStartQuiz }: { onStartQuiz: () => void }) {
  const answers = usePlanner((s) => s.answers);
  const applySample = usePlanner((s) => s.applySampleAnswers);
  const joined = usePlanner((s) => s.detoxJoined);
  const setJoined = usePlanner((s) => s.setDetoxJoined);
  const name = usePlanner((s) => s.setup.name);
  const d = useMemo(() => scoreDiagnostic(answers, diagnosticGroups), [answers]);

  if (d.answered === 0) {
    return (
      <Card className="bg-grid">
        <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Brain className="size-6" />
          </span>
          <h3 className="mt-4 text-[18px] font-semibold">Your Money Profile appears here</h3>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">Answer the 54-question Money Behaviour Diagnostic, or load the sample answers to preview a completed profile.</p>
          <div className="mt-5 flex gap-2">
            <Button variant="accent" onClick={onStartQuiz}>
              Start the diagnostic
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                applySample();
                toast.success("Sample answers loaded");
              }}
            >
              <Wand2 /> Use sample answers
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const band = d.band;
  const incomplete = 54 - d.answered;

  return (
    <div className="space-y-5">
      {incomplete > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-[12.5px] text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            {incomplete} question{incomplete > 1 ? "s" : ""} unanswered. As in the workbook, a pattern with any blank or invalid answer scores 0 until completed.
          </span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card className="overflow-hidden">
          <div className="glow-accent px-6 pb-6 pt-7 text-center">
            <div className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Money Behaviour Score</div>
            <div className="mt-4">
              <ScoreDial score={d.score} />
            </div>
            <div className="mt-5 text-[20px] font-semibold tracking-tight">
              {band.emoji} {band.label}
            </div>
            <p className="mx-auto mt-1 max-w-xs text-[13px] text-muted-foreground">{band.tagline}</p>
            <div className="mt-5 flex h-2 overflow-hidden rounded-full">
              {[...PROFILE_BANDS].reverse().map((b) => (
                <div
                  key={b.key}
                  className={cn("h-full flex-1", b.key === band.key ? "opacity-100" : "opacity-25")}
                  style={{ background: { bucket: "var(--danger)", builder: "var(--warning)", grower: "var(--chart-2)", architect: "var(--success)" }[b.key] }}
                />
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-4 text-[10.5px] text-muted-foreground">
              <span>0–35</span>
              <span>35–60</span>
              <span>60–80</span>
              <span>80–100</span>
            </div>
            <Tooltip content={`Score = 100 − (raw − ${RAW_MIN}) ÷ (${RAW_MAX} − ${RAW_MIN}) × 100. Each pattern/belief is weighted ×1–3 in the workbook.`}>
              <div className="mx-auto mt-4 inline-flex cursor-help items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground">
                Raw total <span className="font-semibold text-foreground tabular">{d.raw}</span> · range {RAW_MIN}–{RAW_MAX}
                <Info className="size-3" />
              </div>
            </Tooltip>
          </div>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          {[
            { kind: "Dominant flow pattern", g: d.dominantFlow, icon: Droplets, tone: "accent" as const },
            { kind: "Dominant belief block", g: d.dominantBelief, icon: Brain, tone: "gold" as const },
          ].map(({ kind, g, icon: Icon, tone }) => (
            <Card key={kind} className="relative overflow-hidden p-6">
              <div className={cn("absolute -right-10 -top-10 size-40 rounded-full blur-2xl", tone === "accent" ? "bg-accent/15" : "bg-gold/20")} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className={cn("inline-flex size-9 items-center justify-center rounded-xl", tone === "accent" ? "bg-accent-soft text-accent" : "bg-gold-soft text-gold")}>
                    <Icon className="size-4" />
                  </span>
                  <IntensityChip intensity={g.intensity} />
                </div>
                <div className="mt-4 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">{kind}</div>
                <div className="mt-1 text-[26px] font-semibold tracking-tight">{g.label}</div>
                <div className="text-[13px] text-muted-foreground">
                  “{g.subtitle}” · {g.score}/15
                </div>
                <p className="mt-4 text-[13.5px]">{g.meaning}</p>
                <div className="mt-4 rounded-xl border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <AlarmClock className="size-3.5" /> Fix on {g.dayToFix}
                  </div>
                  <p className="mt-1 text-[13px]">{g.action}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <GroupList rows={d.flows} title="Money flow patterns" desc="How money moves through your hands · score out of 15" icon={Droplets} />
        <GroupList rows={d.beliefs} title="Money belief profile" desc="The beliefs steering those patterns · score out of 15" icon={Brain} />
      </div>

      {/* Remedy */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 bg-[radial-gradient(700px_circle_at_100%_0%,color-mix(in_srgb,var(--gold)_16%,transparent),transparent_60%)] p-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Badge tone="gold">
              <Sunrise /> The remedy
            </Badge>
            <h3 className="mt-3 text-[22px] font-semibold tracking-tight">5-Day 5AM Finance Detox</h3>
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              No matter what your score is — the {WTF_TOOL.remedy} is designed to rewire your patterns, dissolve your beliefs, and build a system that works even when
              you are tired.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                variant={joined ? "success" : "accent"}
                onClick={() => {
                  setJoined(!joined);
                  if (!joined) toast.success(`${name || "You"} joined the next Detox batch`, { description: `Starts Monday 5:00 AM · ${WTF_TOOL.community}` });
                  else toast("Seat released");
                }}
              >
                {joined ? (
                  <>
                    <Check /> You&apos;re in — Mon 5:00 AM
                  </>
                ) : (
                  "Join the next batch"
                )}
              </Button>
              <span className="text-[12px] text-muted-foreground">{WTF_TOOL.site}</span>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
            {detoxDays.map((day) => {
              const hit = [d.dominantFlow, d.dominantBelief].some((g) => g.dayToFix.includes(day.day.split(" ")[1]));
              return (
                <div key={day.day} className={cn("rounded-xl border p-3", hit ? "border-accent/40 bg-accent-soft" : "border-border bg-card/80")}>
                  <div className={cn("text-[11px] font-semibold uppercase tracking-wider", hit ? "text-accent" : "text-muted-foreground")}>{day.day}</div>
                  <div className="mt-1 text-[13px] font-medium leading-snug">{day.title}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground">{day.focus}</div>
                  {hit && <div className="mt-2 text-[11px] font-medium text-accent">Your focus day</div>}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
