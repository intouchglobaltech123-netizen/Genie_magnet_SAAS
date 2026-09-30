"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, Hourglass } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryBadge } from "@/components/shared/video-bits";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { agreements, clients, personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, inr, inrCompact } from "@/lib/utils";
import { useContent } from "@/features/content/store";
import { POSTS_OWN_CHANNELS } from "@/features/integrations/platforms";
import { currentPhase, lifecycleFor, type LifecyclePhase } from "./lifecycle";

/** Lifecycle for one client, derived from live demo data. */
export function useLifecycle(clientId: string) {
  const videos = useDemo((s) => s.videos);
  const content = useContent((s) => s.items);
  const lists = useContent((s) => s.lists);
  return useMemo(
    () => lifecycleFor(clientId, { videos, content, lists, onboardingOpen: false, partner: !!POSTS_OWN_CHANNELS[clientId] }),
    [clientId, videos, content, lists],
  );
}

export function ClientsView() {
  return (
    <div>
      <PageHeader
        eyebrow="Client Delivery · Clients"
        depth="demo"
        title="Clients"
        description="Every client with where they are in the lifecycle this month, what they pay and what the team is waiting on them for."
      />
      <div className="space-y-3">
        {clients.map((c) => (
          <ClientRow key={c.id} id={c.id} />
        ))}
      </div>
    </div>
  );
}

function ClientRow({ id }: { id: string }) {
  const c = clients.find((x) => x.id === id)!;
  const phases = useLifecycle(id);
  const now = currentPhase(phases);
  const a = agreements.find((x) => x.clientId === id)!;
  const owner = personById(c.accountOwnerId);
  const waiting = phases.flatMap((p) => p.steps.filter((s) => s.state === "waiting").map((s) => `${s.label}${s.note ? ` (${s.note})` : ""}`));
  return (
    <Link href={`/clients/${id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
      <Card className="grid grid-cols-1 gap-4 p-4 transition group-hover:border-primary/40 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-subheading font-semibold">{c.name}</span>
            <CategoryBadge category={c.category} />
          </div>
          <div className="mt-0.5 text-body text-muted-foreground">
            {c.industry} · {c.city} · {a.packageName} · {inr(c.monthlyValue)}/mo
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-body text-muted-foreground">
            <Avatar name={owner.name} size="xs" /> {owner.name} · health {c.health}
            {c.outstanding > 0 && <Badge tone="warning">{inrCompact(c.outstanding)} due</Badge>}
          </div>
        </div>
        <div className="min-w-0">
          <MiniLifecycle phases={phases} />
          <div className={cn("mt-2 text-body", waiting.length ? "text-warning" : "text-muted-foreground")}>
            {waiting.length ? `Waiting on client: ${waiting.join(" · ")}` : `${now.name}${now.period ? ` · ${now.period}` : ""} in progress`}
          </div>
        </div>
        <span className="hidden items-center gap-1 text-body font-medium text-primary lg:inline-flex">
          Open <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </Card>
    </Link>
  );
}

export function MiniLifecycle({ phases }: { phases: LifecyclePhase[] }) {
  return (
    <ol className="flex gap-1" aria-label="Lifecycle">
      {phases.map((p) => (
        <li key={p.id} className="min-w-0 flex-1">
          <div
            className={cn(
              "h-1.5 rounded-full",
              p.state === "done" && "bg-success",
              p.state === "active" && "bg-primary",
              p.state === "waiting" && "bg-accent",
              p.state === "upcoming" && "bg-muted",
            )}
          />
          <div className="mt-1 flex items-center gap-1 truncate text-body text-muted-foreground">
            {p.state === "done" ? <Check className="size-3 text-success" /> : p.state === "waiting" ? <Hourglass className="size-3 text-accent-strong" /> : p.state === "active" ? <Clock className="size-3 text-primary" /> : null}
            <span className={cn(p.state === "active" || p.state === "waiting" ? "font-medium text-text-primary" : "")}>{p.name}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
