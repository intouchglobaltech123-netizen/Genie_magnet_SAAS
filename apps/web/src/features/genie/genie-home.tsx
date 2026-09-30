"use client";

import Link from "next/link";
import { ArrowRight, MessageSquareText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GenieAvatar } from "./ask-panel";
import { insights } from "./data";
import { InsightCard } from "./insight-card";
import { useGenie } from "./store";

const RANK = { high: 0, medium: 1, low: 2 } as const;

/** Home: the top three things Genie Assistant needs a decision on. */
export function GenieHomeCard() {
  const status = useGenie((s) => s.status);
  const setAskOpen = useGenie((s) => s.setAskOpen);
  const open = insights.filter((i) => !status[i.id]).sort((a, b) => RANK[a.severity] - RANK[b.severity]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-primary-soft/40 px-5 py-3.5">
        <GenieAvatar />
        <div className="min-w-0 flex-1">
          <div className="text-subheading font-semibold">Genie Assistant</div>
          <div className="text-body text-muted-foreground">
            {open.length ? `${open.length} things need your decision · drafts are ready` : "Nothing waiting — Genie checks again every hour"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAskOpen(true)}>
            <MessageSquareText /> Ask Genie
          </Button>
          <Button size="sm" asChild>
            <Link href="/genie">
              Open inbox <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-3">
        {open.slice(0, 3).map((i) => (
          <InsightCard key={i.id} insight={i} compact />
        ))}
        {!open.length && (
          <div className="col-span-full flex items-center gap-2 rounded-xl border border-dashed border-border-strong p-4 text-body text-muted-foreground">
            <Sparkles className="size-4" /> All caught up.
          </div>
        )}
      </div>
    </Card>
  );
}
