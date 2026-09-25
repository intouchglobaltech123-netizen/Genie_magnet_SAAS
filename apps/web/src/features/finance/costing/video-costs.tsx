"use client";

import { useMemo, useState } from "react";
import { Info, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { StageBadge } from "@/components/shared/video-bits";
import { clientById, clients } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, inr, pct } from "@/lib/utils";
import { BASE_SCENARIO, costVideo, marginTone, type VideoCost } from "./model";
import { useActiveScenario, useCosting } from "./store";

export function useVideoCosts() {
  const videos = useDemo((s) => s.videos);
  const crs = useDemo((s) => s.changeRequests);
  const sc = useActiveScenario();
  return useMemo(() => {
    const rows = videos.map((v) => costVideo(v, crs, sc));
    const base = sc === BASE_SCENARIO ? rows : videos.map((v) => costVideo(v, crs, BASE_SCENARIO));
    return { rows, base: new Map(base.map((b) => [b.video.id, b])) };
  }, [videos, crs, sc]);
}

function HeadTip({ label, tip, className }: { label: string; tip: string; className?: string }) {
  return (
    <TH className={className}>
      <Tooltip content={tip}>
        <span className="inline-flex cursor-help items-center gap-1">
          {label}
          <Info className="size-3 opacity-60" />
        </span>
      </Tooltip>
    </TH>
  );
}

export function VarianceCell({ c }: { c: VideoCost }) {
  if (!c.complete) {
    const used = c.actual.total / c.standard.total;
    return (
      <div className="flex flex-col items-end gap-0.5">
        <Badge tone="outline">WIP</Badge>
        <span className="text-[11px] text-muted-foreground tabular">{pct(used)} of std used</span>
      </div>
    );
  }
  const over = c.variance > 0;
  const rel = c.variance / c.standard.total;
  return (
    <div className="flex flex-col items-end">
      <span className={cn("font-medium tabular", over ? (rel > 0.1 ? "text-danger" : "text-warning") : "text-success")}>
        {over ? "+" : "−"}
        {inr(Math.abs(c.variance))}
      </span>
      <span className="text-[11px] text-muted-foreground tabular">
        {over ? "+" : "−"}
        {pct(Math.abs(rel))} vs std
      </span>
    </div>
  );
}

export function MarginBadge({ c, base }: { c: VideoCost; base?: VideoCost }) {
  const tone = marginTone(c.marginPct);
  const changed = base && Math.abs(base.marginPct - c.marginPct) > 0.004;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <Badge tone={tone} className="tabular">
        {pct(c.marginPct)}
        {!c.complete && <span className="font-normal opacity-70">proj.</span>}
      </Badge>
      {changed && <span className="text-[10.5px] text-muted-foreground line-through tabular">{pct(base.marginPct)}</span>}
    </div>
  );
}

export function VideoCostTable() {
  const { rows, base } = useVideoCosts();
  const selectedId = useCosting((s) => s.selectedId);
  const select = useCosting((s) => s.select);
  const [client, setClient] = useState("all");
  const [q, setQ] = useState("");

  const filtered = rows.filter(
    (r) =>
      (client === "all" || r.video.clientId === client) &&
      (!q || `${r.video.code} ${r.video.title}`.toLowerCase().includes(q.toLowerCase())),
  );
  const tot = filtered.reduce(
    (a, r) => ({ std: a.std + r.standard.total, act: a.act + r.actual.total, rev: a.rev + r.revenue, proj: a.proj + r.projected }),
    { std: 0, act: 0, rev: 0, proj: 0 },
  );

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Cost per video · Sep 2026 cycle</CardTitle>
          <CardDescription>Live from production — click a row to open its cost waterfall</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or title" className="h-8 w-36 pl-8 text-[13px]" />
          </div>
          <Select
            value={client}
            onValueChange={setClient}
            className="h-8 w-40 text-[13px]"
            options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Video</TH>
            <TH>Format</TH>
            <TH>Stage</TH>
            <HeadTip className="text-right" label="Standard" tip="Planned cost: planned edit minutes + standard director/camera minutes for the format, standard kit hours, overhead on planned hours and shoot travel budget." />
            <HeadTip className="text-right" label="Actual" tip="Logged minutes × hourly cost + kit hours × depreciation/hr + labour hrs × ₹80 overhead + actual travel share + rework." />
            <HeadTip className="text-right" label="Variance" tip="Actual − Standard. Shown once a video reaches client review; before that it is work-in-progress." />
            <HeadTip className="text-right" label="Revenue share" tip="Package monthly fee ÷ Σ(units × format weight) × this video's weight. Weights: Reel/Explainer 1 · Ad/Testimonial 1.5 · Long-form 3 · Static post 0.15 · Story 0.05." />
            <HeadTip className="pr-5 text-right" label="Margin" tip="(Revenue share − true cost) ÷ revenue share. For WIP videos the higher of actual-to-date and standard is used (projected)." />
          </TR>
        </THead>
        <TBody>
          {filtered.map((r) => {
            const v = r.video;
            const active = v.id === selectedId;
            return (
              <TR
                key={v.id}
                onClick={() => select(v.id)}
                className={cn("cursor-pointer", active && "bg-accent-soft/60 hover:bg-accent-soft/60")}
              >
                <TD className="pl-5">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-7 w-0.5 rounded-full", active ? "bg-accent" : "bg-transparent")} />
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] font-semibold">{v.code}</div>
                      <div className="max-w-[220px] truncate text-[12px] text-muted-foreground">
                        {clientById(v.clientId).name} · {v.title}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD className="text-muted-foreground">{v.format}</TD>
                <TD>
                  <StageBadge stage={v.stage} />
                </TD>
                <TD className="text-right tabular text-muted-foreground">{inr(r.standard.total)}</TD>
                <TD className="text-right font-medium tabular">{inr(r.actual.total)}</TD>
                <TD className="text-right">
                  <VarianceCell c={r} />
                </TD>
                <TD className="text-right tabular">{inr(r.revenue)}</TD>
                <TD className="pr-5 text-right">
                  <MarginBadge c={r} base={base.get(v.id)} />
                </TD>
              </TR>
            );
          })}
          <TR className="bg-muted/40 font-medium hover:bg-muted/40">
            <TD className="pl-5" colSpan={3}>
              {filtered.length} videos
            </TD>
            <TD className="text-right tabular text-muted-foreground">{inr(tot.std)}</TD>
            <TD className="text-right tabular">{inr(tot.act)}</TD>
            <TD />
            <TD className="text-right tabular">{inr(tot.rev)}</TD>
            <TD className="pr-5 text-right tabular">{tot.rev ? pct((tot.rev - tot.proj) / tot.rev) : "—"}</TD>
          </TR>
        </TBody>
      </Table>
    </Card>
  );
}
