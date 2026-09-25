"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Network, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { clients, isOverdue, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { inrCompact } from "@/lib/utils";
import { useCrmDemo } from "@/features/crm/crm-store";
import { KpiGrid, RevenueHero } from "./kpis";
import { PipelineByStageCard, PortfolioCard, RevenueTrendCard } from "./charts";
import { AttentionCard } from "./attention";
import { ActivityFeedCard, ReviewCountdownCard, WeekShootsCard, WorkloadCard } from "./side-cards";

export const todayLabel = format(parseISO(TODAY), "EEEE, d MMM yyyy");

export function FounderDashboard() {
  const videos = useDemo((s) => s.videos);
  const pendingDiscount = useCrmDemo((s) => Object.values(s.discounts).filter((d) => d.status === "pending").length);
  const overdue = videos.filter(isOverdue).length;
  const inReview = videos.filter((v) => v.stage === "Client Review").length;
  const outstanding = clients.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> {todayLabel}
          </span>
        }
        title="Good morning, Janarthanan"
        description={
          <>
            <span className="font-medium text-foreground">{overdue} videos overdue</span>, {pendingDiscount ? `${pendingDiscount} approval waiting on you` : "no approvals pending"},{" "}
            {inReview} with clients for review and <span className="font-medium text-foreground">{inrCompact(outstanding)}</span> to collect. September cycle closes in 5 days.
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/modules">
                <Network /> Module map
              </Link>
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => toast.success("Weekly brief shared", { description: "Sent to Ashwin, Priya and Karthik on WhatsApp & email" })}
            >
              <Send /> Share weekly brief
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="xl:col-span-5">
          <RevenueHero />
        </div>
        <div className="xl:col-span-7">
          <KpiGrid />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="xl:col-span-7">
          <AttentionCard />
        </div>
        <div className="space-y-4 xl:col-span-5">
          <ReviewCountdownCard />
          <WeekShootsCard />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="xl:col-span-8">
          <RevenueTrendCard />
        </div>
        <div className="xl:col-span-4">
          <PipelineByStageCard />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12 [&>*]:min-w-0">
        <div className="xl:col-span-5">
          <PortfolioCard />
        </div>
        <div className="xl:col-span-4">
          <WorkloadCard />
        </div>
        <div className="lg:col-span-2 xl:col-span-3">
          <ActivityFeedCard />
        </div>
      </div>
    </div>
  );
}
