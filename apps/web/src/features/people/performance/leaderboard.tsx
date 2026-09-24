"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Flag, Medal, TrendingDown, TrendingUp, Wallet, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, inr } from "@/lib/utils";
import {
  classify,
  compositeFor,
  INCENTIVE_MIN_SCORE,
  INCENTIVE_POOL,
  otherComposites,
  playerMeta,
  playerParams,
  scorecardTrend,
} from "./data";
import type { Appeal } from "./appeal-dialog";

export function rankedTeam() {
  return Object.keys(playerParams)
    .map((id) => ({
      id,
      score: compositeFor(id) ?? 0,
      trend: scorecardTrend[id] ?? otherComposites[id]?.trend ?? 0,
      player: classify(playerParams[id]),
    }))
    .sort((a, b) => b.score - a.score);
}

const medal = ["text-gold", "text-muted-foreground", "text-warning"];

export function Leaderboard({
  appeals,
  onAppeal,
}: {
  appeals: Record<string, Appeal>;
  onAppeal: (id: string) => void;
}) {
  const log = useDemo((s) => s.log);
  const [visible, setVisible] = useState(false);
  const rows = rankedTeam();
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Q3 composite, after quality gates.</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-muted-foreground">
            Visible to team
            <Switch
              checked={visible}
              onCheckedChange={(v) => {
                setVisible(v);
                log(v ? "Q3 leaderboard published to the team" : "Q3 leaderboard hidden from team (admin only)", v ? "success" : "warning");
                toast(v ? "Leaderboard is now visible to the team" : "Leaderboard hidden — admins only", {
                  description: v ? "Employees see rank & composite. Individual KRA details stay private." : "Only Founder, Manager & HR can see rankings.",
                });
              }}
            />
          </label>
          {visible ? (
            <Badge tone="success">
              <Eye /> Visible to team
            </Badge>
          ) : (
            <Badge tone="neutral">
              <EyeOff /> Admin only
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r, i) => {
          const p = personById(r.id);
          const appeal = appeals[r.id];
          return (
            <div key={r.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/60">
              <span className="flex w-6 justify-center text-[13px] font-semibold tabular text-muted-foreground">
                {i < 3 ? <Medal className={cn("size-4", medal[i])} /> : i + 1}
              </span>
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium">{p.name}</span>
                  {appeal && (
                    <Badge tone="warning" className="text-[10.5px]">
                      Under review
                    </Badge>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">{p.role}</div>
              </div>
              <Badge tone={playerMeta[r.player].tone} className="hidden sm:inline-flex">
                {r.player === "A" ? "A" : r.player === "C" ? "C" : r.player.replace("-", " · ")}
              </Badge>
              <span className={cn("flex w-10 items-center justify-end gap-0.5 text-[11.5px] tabular", r.trend >= 0 ? "text-success" : "text-danger")}>
                {r.trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(r.trend)}
              </span>
              <span className="w-10 text-right text-[14px] font-semibold tabular">{r.score.toFixed(0)}</span>
              <Tooltip content={appeal ? "Appeal already filed" : "Appeal this score"}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 opacity-60 group-hover:opacity-100"
                  disabled={!!appeal}
                  onClick={() => onAppeal(r.id)}
                  aria-label={`Appeal score for ${p.name}`}
                >
                  <Flag className="size-3.5" />
                </Button>
              </Tooltip>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function IncentivePool() {
  const log = useDemo((s) => s.log);
  const [released, setReleased] = useState(false);
  const rows = rankedTeam();
  const eligible = rows.filter((r) => r.score >= INCENTIVE_MIN_SCORE);
  const sum = eligible.reduce((s, r) => s + r.score, 0);
  const shares = eligible.map((r) => ({ ...r, amount: Math.round(((r.score / sum) * INCENTIVE_POOL) / 10) * 10 }));
  const max = Math.max(...shares.map((s) => s.amount));
  const excluded = rows.filter((r) => r.score < INCENTIVE_MIN_SCORE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gold-soft text-gold">
            <Wallet className="size-5" />
          </span>
          <div>
            <CardTitle>Q3 incentive pool · {inr(INCENTIVE_POOL)}</CardTitle>
            <CardDescription>
              Split in proportion to composite score. Eligibility: composite ≥ {INCENTIVE_MIN_SCORE}. Capped scores are used as-is.
            </CardDescription>
          </div>
        </div>
        {released ? (
          <Badge tone="success" className="px-2.5 py-1">
            <CheckCircle2 /> Released to October payroll
          </Badge>
        ) : (
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setReleased(true);
              log(`Q3 incentives of ${inr(INCENTIVE_POOL)} released to October payroll (${shares.length} employees)`, "success");
              toast.success("Incentives released to payroll", {
                description: `${shares.length} employees · ${inr(INCENTIVE_POOL)} will appear on October payslips.`,
              });
            }}
          >
            Approve &amp; release
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-10 gap-y-3 md:grid-cols-2">
          {shares.map((s) => {
            const p = personById(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="truncate font-medium">
                      {p.name}
                      <span className="ml-1.5 font-normal text-muted-foreground tabular">· {s.score.toFixed(0)}</span>
                    </span>
                    <span className="font-semibold tabular">{inr(s.amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--chart-1)] transition-all duration-700"
                      style={{ width: `${(s.amount / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {excluded.length > 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-3 text-[12.5px] text-muted-foreground">
            Not eligible this quarter:{" "}
            {excluded.map((e) => (
              <span key={e.id} className="font-medium text-foreground">
                {personById(e.id).name} ({e.score.toFixed(0)})
              </span>
            ))}{" "}
            — below {INCENTIVE_MIN_SCORE}. A performance improvement plan is recommended.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
