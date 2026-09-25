"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { employees, personById } from "@/lib/mock/core";
import { weeklyTemplate } from "@/lib/mock/management";
import { cn, fmtDate } from "@/lib/utils";
import { commitmentState, useMgmt } from "../store";

const toneText = { success: "text-success", warning: "text-warning", danger: "text-danger", accent: "text-primary", info: "text-info" } as const;

export function WeeklyReview() {
  const commitments = useMgmt((s) => s.commitments);
  const setDone = useMgmt((s) => s.setDone);
  const addCommitment = useMgmt((s) => s.addCommitment);
  const last = commitments.filter((c) => c.reviewInMeetingId === "rv-w39");
  const next = commitments.filter((c) => c.sourceMeetingId === "rv-w39");
  const [text, setText] = useState("");
  const [owner, setOwner] = useState("p-ashwin");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-subheading font-semibold">Weekly Agency Review · W40 — template preview</div>
            <div className="text-body text-muted-foreground">Mon 28 Sep · 10:00 AM · 60 min · Ashwin facilitates · data prefilled from last 7 days (21–27 Sep)</div>
          </div>
          <Badge tone="info">Prefilled · refreshes when meeting opens</Badge>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {weeklyTemplate.map((sec, i) => (
          <Card key={sec.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-body font-semibold text-muted-foreground">{i + 2}</span>
                {sec.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2.5">
              {sec.items.map((it) => (
                <div key={it.label} className="rounded-xl border border-border p-3">
                  <div className="text-body text-muted-foreground">{it.label}</div>
                  <div className={cn("mt-1 text-subheading font-semibold tabular", toneText[it.tone])}>{it.value}</div>
                  <div className="text-body text-muted-foreground">{it.sub}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-body font-semibold text-muted-foreground">1</span>
                Last week&apos;s commitments
              </CardTitle>
              <CardDescription>From Weekly Review W39 · tick when done</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {last.map((c) => {
              const st = commitmentState(c);
              return (
                <label key={c.id} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
                  <Checkbox checked={c.status === "done"} onCheckedChange={(v) => setDone(c.id, !!v)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-body", c.status === "done" && "text-muted-foreground line-through")}>{c.text}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-body text-muted-foreground">
                      <Avatar name={personById(c.ownerId).name} size="xs" />
                      {personById(c.ownerId).name} · due {fmtDate(c.due)}
                    </div>
                  </div>
                  <Badge tone={st === "done" ? "success" : st === "overdue" ? "danger" : "outline"}>{st}</Badge>
                </label>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-body font-semibold text-muted-foreground">5</span>
                Next week priorities
              </CardTitle>
              <CardDescription>Each priority becomes a commitment with an owner</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!text.trim()) return;
                addCommitment({ text: text.trim(), ownerId: owner, due: "2026-10-03", sourceMeetingId: "rv-w39", reviewInMeetingId: "rv-w39" });
                toast.success("Priority added as commitment", { description: `${personById(owner).name} · due 3 Oct` });
                setText("");
              }}
            >
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Deliver all 5 Kaveri Oct reels scripts" className="h-8 min-w-48 flex-1 text-body" />
              <Select value={owner} onValueChange={setOwner} className="h-8 w-36 text-body" options={employees.map((p) => ({ value: p.id, label: p.name }))} />
              <Button type="submit" size="sm" variant="outline">
                <Plus /> Add
              </Button>
            </form>
            {next.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-body text-muted-foreground">No priorities yet — add the top 3–5 for next week.</p>
            ) : (
              <ul className="space-y-1.5">
                {next.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-body">
                    <Avatar name={personById(c.ownerId).name} size="xs" />
                    <span className="flex-1">{c.text}</span>
                    <span className="text-body text-muted-foreground">{fmtDate(c.due)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
