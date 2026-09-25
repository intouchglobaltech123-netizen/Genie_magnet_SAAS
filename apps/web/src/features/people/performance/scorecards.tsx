"use client";

import { useState } from "react";
import { AlertTriangle, Flag, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { personById } from "@/lib/mock/core";
import { cn } from "@/lib/utils";
import { achievement, composite, scorecards, weighted, type Kra, type RoleScorecard } from "./data";
import type { Appeal } from "./appeal-dialog";

const fmt = (k: Kra, v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${k.unit}`;

export function RoleScorecards({
  appeals,
  onAppeal,
}: {
  appeals: Record<string, Appeal>;
  onAppeal: (personId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Role scorecards · Q3 (Jul–Sep 2026)</CardTitle>
          <CardDescription>Weighted KRAs per role. Quality gates cap the composite when a critical measure slips.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="editor">
          <TabsList>
            {scorecards.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.role}
                <span className="text-muted-foreground tabular">{s.people.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {scorecards.map((s) => (
            <TabsContent key={s.id} value={s.id}>
              <RolePanel sc={s} appeals={appeals} onAppeal={onAppeal} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function RolePanel({ sc, appeals, onAppeal }: { sc: RoleScorecard; appeals: Record<string, Appeal>; onAppeal: (id: string) => void }) {
  const [pid, setPid] = useState(sc.people.find((p) => p.personId === "p-surya")?.personId ?? sc.people[0].personId);
  const entry = sc.people.find((p) => p.personId === pid)!;
  const person = personById(pid);
  const c = composite(entry.kras, sc.gate);
  const appeal = appeals[pid];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {sc.people.map((p) => {
            const pp = personById(p.personId);
            const cc = composite(p.kras, sc.gate);
            return (
              <button
                key={p.personId}
                type="button"
                onClick={() => setPid(p.personId)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                  pid === p.personId ? "border-primary/50 bg-primary-soft/60" : "border-border hover:bg-muted",
                )}
              >
                <Avatar name={pp.name} size="sm" />
                <div>
                  <div className="text-body font-medium leading-tight">{pp.name}</div>
                  <div className="text-body text-muted-foreground tabular">
                    Composite {Math.round(cc.final)}
                    {cc.triggered && <span className="text-danger"> · capped</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-body text-muted-foreground">
          <ShieldCheck className="size-4" /> Gate: {sc.gate.label}
        </div>
      </div>

      {c.triggered ? (
        <div className="flex gap-3 rounded-xl border border-danger/30 bg-danger-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" />
          <div className="text-body">
            <div className="font-semibold text-danger">Quality gate triggered — score capped</div>
            <p className="mt-0.5 text-foreground/80">
              {person.name.split(" ")[0]}&apos;s {sc.gate.kra.toLowerCase()} is{" "}
              <b className="tabular">{c.gateActual}%</b> (gate: {sc.gate.threshold}%). Raw composite{" "}
              <b className="tabular">{c.raw.toFixed(1)}</b> is capped at <b className="tabular">{sc.gate.cap}</b> until quality recovers.
              Output volume can&apos;t compensate for rework.
            </p>
          </div>
        </div>
      ) : c.gateActual !== undefined && c.gateActual <= sc.gate.threshold ? (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4 text-body">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <div className="font-semibold text-warning">On the edge of the quality gate</div>
            <p className="mt-0.5 text-foreground/80">
              {sc.gate.kra} at <b className="tabular">{c.gateActual}%</b> — one more miss next month caps the composite at {sc.gate.cap}.
            </p>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <THead>
            <TR className="bg-muted/40">
              <TH className="pl-4">KRA</TH>
              <TH className="text-right">Target</TH>
              <TH className="text-right">Actual</TH>
              <TH className="w-40">Achievement</TH>
              <TH className="text-right">Weight</TH>
              <TH className="pr-4 text-right">Weighted score</TH>
            </TR>
          </THead>
          <TBody>
            {entry.kras.map((k) => {
              const a = achievement(k);
              const isGate = k.kra === sc.gate.kra;
              return (
                <TR key={k.kra} className={cn(isGate && c.triggered && "bg-danger-soft/50 hover:bg-danger-soft/60")}>
                  <TD className="pl-4">
                    <div className="flex items-center gap-1.5 font-medium">
                      {k.kra}
                      {isGate && (
                        <Badge tone={c.triggered ? "danger" : "outline"} className="text-body">
                          Gate
                        </Badge>
                      )}
                    </div>
                    <div className="text-body text-muted-foreground">
                      {k.measurement}
                      {k.lowerIsBetter ? " · lower is better" : ""}
                    </div>
                  </TD>
                  <TD className="text-right tabular text-muted-foreground">{fmt(k, k.target)}</TD>
                  <TD className="text-right font-medium tabular">{fmt(k, k.actual)}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={a * 100} tone={a >= 0.95 ? "success" : a >= 0.85 ? "warning" : "danger"} className="flex-1" />
                      <span className="w-9 text-right text-body tabular text-muted-foreground">{Math.round(a * 100)}%</span>
                    </div>
                  </TD>
                  <TD className="text-right tabular text-muted-foreground">{k.weight}%</TD>
                  <TD className="pr-4 text-right font-semibold tabular">{weighted(k).toFixed(1)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {appeal ? (
              <Badge tone={appeal.status === "resolved" ? "success" : "warning"} dot>
                {appeal.status === "resolved" ? "Appeal resolved" : "Appeal under review"}
              </Badge>
            ) : (
              <Button variant="ghost" size="xs" onClick={() => onAppeal(pid)}>
                <Flag /> Appeal this score
              </Button>
            )}
          </div>
          <div className="flex items-center gap-5 text-body">
            <span className="text-muted-foreground">
              Raw <b className="font-semibold text-foreground tabular">{c.raw.toFixed(1)}</b>
            </span>
            {c.triggered && (
              <span className="text-danger">
                Cap <b className="tabular">{sc.gate.cap}</b>
              </span>
            )}
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Composite</span>
              <span className={cn("text-heading font-semibold tabular", c.triggered ? "text-danger" : "text-foreground")}>
                {c.final.toFixed(1)}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
