"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hourglass, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  EMOTIONS,
  LEAK_TYPES,
  leakage,
  opportunityCost15,
  withCalc,
  type Emotion,
  type LeakType,
  type RuleUsed,
  type SpendKind,
} from "@/features/planner/calc";
import { usePlanner } from "@/features/planner/store";
import { KindPill, kindMeta, MoodFace, MoodPicker, Segmented } from "@/features/planner/ui";
import { cn, inr, inrCompact } from "@/lib/utils";

const KINDS: SpendKind[] = ["Need", "Want", "Craving"];
const quickPicks = ["Tea & snacks", "Swiggy / Zomato", "Groceries", "Petrol", "Online shopping", "Movie", "Recharge"];
const leakHint: Record<LeakType, string> = {
  GEYSER: "Sudden burst",
  DRIPPER: "Slow & low",
  RESERVOIR: "Idle savings",
  OOZER: "Silent leak",
  PURIFIER: "Over-analysing",
  "CLOUD BURST": "Controlled, then flood",
  "THE DAM": "Avoidance",
  SPRINKLER: "Tiny spends",
  MIRAGE: "Looks wealthy",
  NONE: "No leak",
};

type Filter = "all" | SpendKind | "leaks";

export function LogTab() {
  const log = usePlanner((s) => s.log);
  const addEntry = usePlanner((s) => s.addEntry);
  const updateEntry = usePlanner((s) => s.updateEntry);
  const removeEntry = usePlanner((s) => s.removeEntry);

  const [day, setDay] = useState(25);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<SpendKind>("Want");
  const [leakType, setLeakType] = useState<LeakType>("SPRINKLER");
  const [emotion, setEmotion] = useState<Emotion>("Boredom");
  const [mood, setMood] = useState(3);
  const [rule48, setRule48] = useState<RuleUsed>("No");
  const [filter, setFilter] = useState<Filter>("all");

  const amt = Number(amount.replace(/[^0-9.]/g, "")) || 0;
  const previewLeak = leakage({ kind, amount: amt, rule48 });

  const setKindSmart = (k: SpendKind) => {
    setKind(k);
    if (k === "Want") setRule48("No");
    else setRule48("NA");
    if (k === "Need") setLeakType("NONE");
    else if (leakType === "NONE") setLeakType("SPRINKLER");
  };

  const submit = () => {
    if (!item.trim() || !amt) {
      toast.error("Add what you spent on and the amount");
      return;
    }
    addEntry({ day, date: `2026-09-${String(day).padStart(2, "0")}`, item: item.trim(), amount: amt, kind, leakType, emotion, mood, rule48 });
    const l = leakage({ kind, amount: amt, rule48 });
    if (l > 0) toast.warning(`${inr(l)} leakage logged`, { description: `If invested monthly, that's ${inr(opportunityCost15(l))} in 15 years.` });
    else toast.success("Spend logged — no leakage", { description: kind === "Want" ? "Nice — the 48-hr rule saved you." : undefined });
    setItem("");
    setAmount("");
  };

  const rows = useMemo(() => log.map(withCalc), [log]);
  const filtered = rows.filter((r) => (filter === "all" ? true : filter === "leaks" ? r.leak > 0 : r.kind === filter));
  const byDay = useMemo(() => {
    const m = new Map<number, typeof filtered>();
    [...filtered].sort((a, b) => b.day - a.day).forEach((r) => m.set(r.day, [...(m.get(r.day) ?? []), r]));
    return [...m.entries()];
  }, [filtered]);

  const totals = rows.reduce((s, r) => ({ spent: s.spent + r.amount, leak: s.leak + r.leak, opp: s.opp + r.opp }), { spent: 0, leak: 0, opp: 0 });
  const daysLogged = new Set(rows.map((r) => r.day)).size;

  return (
    <div className="space-y-5">
      {/* Quick add */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[88px] space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">Day</div>
            <Select
              value={String(day)}
              onValueChange={(v) => setDay(Number(v))}
              options={Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1}` }))}
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">What did I spend on?</div>
            <Input value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="e.g. Swiggy biryani at 11 pm" />
          </div>
          <div className="w-[120px] space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">Amount</div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">₹</span>
              <Input value={amount} inputMode="numeric" onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="pl-7 tabular" placeholder="0" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">Need / Want / Craving</div>
            <Segmented
              value={kind}
              onChange={setKindSmart}
              options={KINDS.map((k) => ({ value: k, label: k, activeCls: cn(kindMeta[k].soft, kindMeta[k].text) }))}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-[170px] space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">Leak type</div>
            <Select
              value={leakType}
              onValueChange={(v) => setLeakType(v as LeakType)}
              options={LEAK_TYPES.map((t) => ({ value: t, label: `${t} · ${leakHint[t]}` }))}
            />
          </div>
          <div className="w-[200px] space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">Emotion before spend</div>
            <Select value={emotion} onValueChange={(v) => setEmotion(v as Emotion)} options={EMOTIONS.map((e) => ({ value: e, label: e }))} />
          </div>
          <div className="space-y-1.5">
            <div className="text-body font-medium text-muted-foreground">Mood after</div>
            <MoodPicker value={mood} onChange={setMood} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 text-body font-medium text-muted-foreground">
              <Hourglass className="size-3" /> 48-hr rule used?
            </div>
            <Segmented
              value={rule48}
              onChange={setRule48}
              options={[
                { value: "Yes", label: "Yes", activeCls: "bg-success-soft text-success" },
                { value: "No", label: "No", activeCls: "bg-danger-soft text-danger" },
                { value: "NA", label: "NA" },
              ]}
            />
          </div>
          <div className="ml-auto flex items-end gap-3">
            <div className="text-right">
              <div className="text-body text-muted-foreground">Leakage · 15-yr cost</div>
              <div className={cn("text-body font-semibold tabular", previewLeak > 0 ? "text-danger" : "text-success")}>
                {inr(previewLeak)} <span className="text-muted-foreground">·</span> {inrCompact(opportunityCost15(previewLeak))}
              </div>
            </div>
            <Button variant="accent" onClick={submit}>
              <Plus /> Add spend
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-body text-muted-foreground">Quick:</span>
          {quickPicks.map((q) => (
            <button key={q} onClick={() => setItem(q)} className="cursor-pointer rounded-full border border-border px-2.5 py-0.5 text-body text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
              {q}
            </button>
          ))}
        </div>
      </Card>

      {/* Totals + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-5 text-body">
          <span>
            <span className="text-muted-foreground">Days logged</span> <span className="font-semibold tabular">{daysLogged}/30</span>
          </span>
          <span>
            <span className="text-muted-foreground">Spent</span> <span className="font-semibold tabular">{inr(totals.spent)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Leakage</span> <span className="font-semibold text-danger tabular">{inr(totals.leak)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Σ 15-yr opportunity cost</span> <span className="font-semibold tabular">{inrCompact(totals.opp)}</span>
          </span>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "Need", label: "Need" },
            { value: "Want", label: "Want" },
            { value: "Craving", label: "Craving" },
            { value: "leaks", label: "Leaks only" },
          ]}
        />
      </div>

      {/* Day groups */}
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[1fr_96px_92px_120px_170px_48px_72px_96px_96px_36px] gap-3 border-b border-border px-4 py-2.5 text-body font-medium uppercase tracking-wider text-muted-foreground lg:grid">
          <span>Spend</span>
          <span className="text-right">Amount</span>
          <span>Type</span>
          <span>Leak type</span>
          <span>Emotion before</span>
          <span>Mood</span>
          <span>48-hr</span>
          <span className="text-right">Leakage</span>
          <span className="text-right">15-yr cost</span>
          <span />
        </div>
        {byDay.length === 0 && (
          <div className="px-4 py-16 text-center text-body text-muted-foreground">No spends here yet. Add your first one above — be 100% honest with yourself.</div>
        )}
        {byDay.map(([d, entries]) => {
          const dayLeak = entries.reduce((s, e) => s + e.leak, 0);
          const daySpend = entries.reduce((s, e) => s + e.amount, 0);
          return (
            <div key={d} className="border-b border-border last:border-0">
              <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                <div className="flex items-center gap-2 text-body">
                  <span className="font-semibold">Day {d}</span>
                  <span className="text-muted-foreground">
                    {new Date(entries[0].date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-body tabular">
                  <span className="text-muted-foreground">{inr(daySpend)}</span>
                  {dayLeak > 0 ? <Badge tone="danger">{inr(dayLeak)} leaked</Badge> : <Badge tone="success">Clean day</Badge>}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {entries.map((e) => (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="group grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-body lg:grid-cols-[1fr_96px_92px_120px_170px_48px_72px_96px_96px_36px]"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{e.item}</div>
                      {e.notes && <div className="truncate text-body text-muted-foreground">{e.notes}</div>}
                    </div>
                    <div className="text-right font-medium tabular">{inr(e.amount)}</div>
                    <div>
                      <KindPill kind={e.kind} />
                    </div>
                    <div className="text-body text-muted-foreground">{e.leakType === "NONE" ? "—" : e.leakType}</div>
                    <div className="truncate text-body">{e.emotion}</div>
                    <div>
                      <MoodFace mood={e.mood} />
                    </div>
                    <div>
                      <Tooltip content="Click to change · only 'No' on a Want counts as leakage">
                        <button
                          onClick={() => {
                            const next: RuleUsed = e.rule48 === "Yes" ? "No" : e.rule48 === "No" ? "NA" : "Yes";
                            updateEntry(e.id, { rule48: next });
                          }}
                          className={cn(
                            "cursor-pointer rounded-md px-1.5 py-0.5 text-body font-medium",
                            e.rule48 === "Yes" ? "bg-success-soft text-success" : e.rule48 === "No" ? "bg-danger-soft text-danger" : "bg-muted text-muted-foreground",
                          )}
                        >
                          {e.rule48}
                        </button>
                      </Tooltip>
                    </div>
                    <div className={cn("text-right font-medium tabular", e.leak > 0 ? "text-danger" : "text-muted-foreground")}>
                      {e.leak > 0 ? inr(e.leak) : "—"}
                    </div>
                    <div className="text-right tabular text-muted-foreground">{e.opp > 0 ? inrCompact(e.opp) : "—"}</div>
                    <div className="text-right">
                      <button
                        onClick={() => {
                          removeEntry(e.id);
                          toast("Entry removed", { description: e.item });
                        }}
                        className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          );
        })}
      </Card>
      <CardContent className="flex items-start gap-2 p-0 text-body text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Leakage = 100% of a Craving, or 50% of a Want bought without the 48-hr rule. 15-yr cost = that amount invested every month for 15 years at 12% (1%/month, 180 months).
        </span>
      </CardContent>
    </div>
  );
}
