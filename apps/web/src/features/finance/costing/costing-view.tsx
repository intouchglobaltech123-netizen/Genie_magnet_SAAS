"use client";

import { Download, FlaskConical, RotateCcw, Scale, Timer, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, pct } from "@/lib/utils";
import { ClientProfitability } from "./client-profitability";
import { ModelExplainer } from "./model-explainer";
import { OverheadPools } from "./overhead";
import { CostingSettings, ScenarioControls } from "./settings";
import { useCosting } from "./store";
import { VideoCostTable, useVideoCosts } from "./video-costs";
import { CostWaterfall } from "./waterfall";

export function CostingView() {
  const { rows } = useVideoCosts();
  const scenarioOn = useCosting((s) => s.scenarioOn);
  const sc = useCosting((s) => s.scenario);
  const setOn = useCosting((s) => s.setScenarioOn);

  const complete = rows.filter((r) => r.complete);
  const reels = complete.filter((r) => r.video.format === "Reel");
  const avgReel = reels.length ? reels.reduce((s, r) => s + r.actual.total, 0) / reels.length : 0;
  const rev = complete.reduce((s, r) => s + r.revenue, 0);
  const margin = complete.reduce((s, r) => s + r.margin, 0);
  const variance = complete.reduce((s, r) => s + r.variance, 0);
  const std = complete.reduce((s, r) => s + r.standard.total, 0);
  const rework = rows.reduce((s, r) => s + r.actual.rework, 0);
  const reworkVideos = rows.filter((r) => r.actual.rework > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance · Module 35"
        depth="demo"
        title="True Costing"
        description="What every video really costs — labour, equipment, shared overhead, travel and rework — against the revenue it earns from its package."
        className="mb-0"
        actions={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={scenarioOn ? "soft" : "outline"} size="sm">
                  <FlaskConical /> {scenarioOn ? "Scenario on" : "Scenario"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-4">
                <ScenarioControls compact />
              </PopoverContent>
            </Popover>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast.success("Costing export ready", { description: "true-cost-sep-2026.xlsx · 20 videos, 5 cycles, rate card v3" })}
            >
              <Download /> Export
            </Button>
          </>
        }
      />

      {scenarioOn && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-2.5 text-body">
          <div className="flex items-center gap-2 text-primary">
            <FlaskConical className="size-4" />
            <span className="font-medium">Scenario mode</span>
            <span className="text-foreground/80">
              Rates {sc.labourPct >= 0 ? "+" : ""}
              {sc.labourPct}% · Overhead {sc.overheadPct >= 0 ? "+" : ""}
              {sc.overheadPct}% · Camera life {sc.cameraLifeYears} yr — what-if only, actuals & locked periods untouched
            </span>
          </div>
          <Button variant="ghost" size="xs" onClick={() => setOn(false)}>
            <X /> Exit scenario
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Avg true cost · Reel" value={inr(avgReel)} icon={Scale} tone="accent" hint={`${reels.length} delivered reels · package share ₹4–5.3K each`} />
        <StatCard label="Margin on delivered work" value={pct(rev ? margin / rev : 0)} icon={TrendingUp} tone="success" hint={`${inr(margin)} on ${inr(rev)}`} />
        <StatCard
          label="Cost variance vs standard"
          value={`${variance >= 0 ? "+" : "−"}${inr(Math.abs(variance))}`}
          icon={Timer}
          tone={variance > 0 ? "warning" : "success"}
          hint={`${pct(std ? Math.abs(variance) / std : 0)} ${variance > 0 ? "over" : "under"} on ${complete.length} videos`}
        />
        <StatCard label="Rework cost · Sep" value={inr(rework)} icon={RotateCcw} tone="danger" hint={`${reworkVideos} videos with agency corrections`} />
      </div>

      <ModelExplainer />

      <Tabs defaultValue="videos">
        <TabsList className="scrollbar-thin max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="videos">Per video</TabsTrigger>
          <TabsTrigger value="clients">Clients & cycles</TabsTrigger>
          <TabsTrigger value="overhead">Overhead & equipment</TabsTrigger>
          <TabsTrigger value="settings">Rates & settings</TabsTrigger>
        </TabsList>
        <TabsContent value="videos">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <VideoCostTable />
            <div className="xl:sticky xl:top-20 xl:self-start">
              <CostWaterfall />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="clients">
          <ClientProfitability />
        </TabsContent>
        <TabsContent value="overhead">
          <OverheadPools />
        </TabsContent>
        <TabsContent value="settings">
          <CostingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
