"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Award, Gauge, ShieldAlert, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { inr } from "@/lib/utils";
import { composite, INCENTIVE_POOL, scorecards } from "./data";
import { AppealDialog, type Appeal } from "./appeal-dialog";
import { IncentivePool, Leaderboard, rankedTeam } from "./leaderboard";
import { PlayerGrid } from "./player-grid";
import { RoleScorecards } from "./scorecards";

export function PerformanceView() {
  const log = useDemo((s) => s.log);
  const [appeals, setAppeals] = useState<Record<string, Appeal>>({});
  const [appealFor, setAppealFor] = useState<string | null>(null);

  const team = rankedTeam();
  const avg = team.reduce((s, r) => s + r.score, 0) / team.length;
  const aPlayers = team.filter((r) => r.player === "A").length;
  const gates = scorecards.flatMap((s) => s.people.filter((p) => composite(p.kras, s.gate).triggered));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Performance & KRA"
        description="Role-based KRA scorecards with quality gates, A/B/C player ratings, and a transparent incentive split."
        depth="preview"
        className="mb-0"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Q3 review pack generated", { description: "9 one-page scorecards ready for 45-day reviews." })}
          >
            Generate review pack
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Team composite (avg)" value={avg.toFixed(1)} icon={Gauge} delta={0.03} deltaLabel="vs Q2" tone="accent" />
        <StatCard label="A players" value={`${aPlayers} of ${team.length}`} icon={Award} hint="Competence & commitment ≥ 4" tone="success" />
        <StatCard
          label="Quality gates triggered"
          value={gates.length}
          icon={ShieldAlert}
          hint={gates.map((g) => personById(g.personId).name.split(" ")[0]).join(", ") || "None"}
          tone="danger"
        />
        <StatCard label="Q3 incentive pool" value={inr(INCENTIVE_POOL)} icon={Wallet} hint="Split by composite" tone="gold" />
      </div>

      <RoleScorecards appeals={appeals} onAppeal={setAppealFor} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <PlayerGrid />
        </div>
        <div className="xl:col-span-2">
          <Leaderboard appeals={appeals} onAppeal={setAppealFor} />
        </div>
      </div>

      <IncentivePool />

      <AppealDialog
        personId={appealFor}
        onOpenChange={(o) => !o && setAppealFor(null)}
        onSubmit={(id, a) => {
          setAppeals((s) => ({ ...s, [id]: a }));
          const name = personById(id).name;
          log(`${name} appealed ${a.kra} score — under review by Ashwin`, "warning");
          toast.success("Appeal submitted", { description: `${name} · ${a.kra}. Status: Under review (decision within 5 working days).` });
        }}
      />
    </div>
  );
}
