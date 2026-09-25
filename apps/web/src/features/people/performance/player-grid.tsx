"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { personById } from "@/lib/mock/core";
import { cn } from "@/lib/utils";
import { classify, playerMeta, playerParams, type Params, type Player } from "./data";

const quadrants: { key: Player; pos: string; bg: string }[] = [
  { key: "B-Commitment", pos: "col-start-1 row-start-1", bg: "bg-warning-soft/40" },
  { key: "A", pos: "col-start-2 row-start-1", bg: "bg-success-soft/60" },
  { key: "C", pos: "col-start-1 row-start-2", bg: "bg-danger-soft/40" },
  { key: "B-Competence", pos: "col-start-2 row-start-2", bg: "bg-info-soft/50" },
];

const competenceKeys: (keyof Params)[] = ["Skill", "Knowledge"];
const commitmentKeys: (keyof Params)[] = ["Self image", "Motive", "Trait"];

export function PlayerGrid() {
  const entries = Object.entries(playerParams).map(([id, p]) => ({ id, p, player: classify(p) }));
  return (
    <Card className="h-full">
      <CardHeader>
        <div>
          <CardTitle>Player rating</CardTitle>
          <CardDescription>Competence (skill &amp; knowledge) vs commitment (self-image, motive, trait). Click anyone for their scores.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <div className="flex w-5 items-center justify-center">
            <span className="-rotate-90 whitespace-nowrap text-body font-medium uppercase tracking-wider text-muted-foreground">
              Commitment →
            </span>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 grid-rows-2 gap-2">
              {quadrants.map((q) => {
                const meta = playerMeta[q.key];
                const people = entries.filter((e) => e.player === q.key);
                return (
                  <div key={q.key} className={cn("min-h-40 rounded-xl border border-border p-3.5", q.pos, q.bg)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <div className="mt-1 text-body text-muted-foreground">{meta.desc}</div>
                      </div>
                      <span className="text-subheading font-semibold tabular text-muted-foreground">{people.length}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {people.map((e) => (
                        <PersonChip key={e.id} id={e.id} p={e.p} player={e.player} />
                      ))}
                    </div>
                    <div className="mt-3 text-body font-medium text-text-secondary">→ {meta.action}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-center text-body font-medium uppercase tracking-wider text-muted-foreground">Competence →</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonChip({ id, p, player }: { id: string; p: Params; player: Player }) {
  const person = personById(id);
  const total = Object.values(p).reduce((a, b) => a + b, 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${person.name} — view scores`}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2.5 text-body font-medium shadow-card transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <Avatar name={person.name} size="sm" className="ring-0" />
          {person.name.split(" ")[0]}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="flex items-center gap-2.5">
          <Avatar name={person.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-semibold">{person.name}</div>
            <div className="truncate text-body text-muted-foreground">{person.role}</div>
          </div>
          <Badge tone={playerMeta[player].tone}>{playerMeta[player].label}</Badge>
        </div>
        <div className="mt-3 space-y-3">
          <ParamGroup title="Competence" keys={competenceKeys} p={p} />
          <ParamGroup title="Commitment" keys={commitmentKeys} p={p} />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-body">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular">{total}/25</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ParamGroup({ title, keys, p }: { title: string; keys: (keyof Params)[]; p: Params }) {
  return (
    <div>
      <div className="mb-1.5 text-body font-medium text-muted-foreground">{title}</div>
      <div className="space-y-1.5">
        {keys.map((k) => (
          <div key={k} className="flex items-center justify-between text-body">
            <span>{k}</span>
            <span className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "size-2.5 rounded-full",
                    n <= p[k] ? (p[k] >= 4 ? "bg-success" : "bg-warning") : "bg-muted",
                  )}
                />
              ))}
              <span className="ml-1.5 w-3 text-right font-semibold tabular">{p[k]}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
