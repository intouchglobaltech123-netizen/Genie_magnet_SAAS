"use client";

import { useState } from "react";
import { AlertOctagon, BellRing, Check, CheckCircle2, Pencil, Sun } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { personById } from "@/lib/mock/core";
import type { StandupEntry } from "@/lib/mock/management";
import { cn } from "@/lib/utils";
import { useMgmt } from "../store";

export function DailyStandup() {
  const standups = useMgmt((s) => s.standups);
  const addCommitment = useMgmt((s) => s.addCommitment);
  const [converted, setConverted] = useState<string[]>([]);
  const submitted = standups.filter((s) => s.submitted).length;
  const blockers = standups.filter((s) => s.blockers.trim());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-info-soft text-info">
                <Sun className="size-5" />
              </span>
              <div>
                <div className="text-[15px] font-semibold">Operational stand-up · Fri 25 Sep</div>
                <div className="text-[12.5px] text-muted-foreground">9:30 – 9:45 AM · facilitated by Ashwin · focus: Clarity</div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const pending = standups.filter((s) => !s.submitted).map((s) => personById(s.personId).name.split(" ")[0]);
                toast(pending.length ? `Nudged ${pending.join(" & ")}` : "Everyone has submitted", {
                  description: pending.length ? "WhatsApp + in-app reminder sent to fill today's stand-up." : undefined,
                });
              }}
            >
              <BellRing /> Nudge pending
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={(submitted / standups.length) * 100} tone="info" className="flex-1" />
            <span className="text-[12.5px] text-muted-foreground tabular">
              {submitted}/{standups.length} submitted
            </span>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold">
            <AlertOctagon className="size-4 text-danger" /> Blockers ({blockers.length})
          </div>
          <ul className="mt-3 space-y-2.5">
            {blockers.map((b) => {
              const p = personById(b.personId);
              const done = converted.includes(b.personId);
              return (
                <li key={b.personId} className="flex items-start gap-2 text-[12.5px]">
                  <Avatar name={p.name} size="xs" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{p.name.split(" ")[0]}:</span> <span className="text-muted-foreground">{b.blockers}</span>
                  </div>
                  <Button
                    size="xs"
                    variant={done ? "ghost" : "soft"}
                    disabled={done}
                    onClick={() => {
                      addCommitment({
                        text: `Unblock ${p.name.split(" ")[0]}: ${b.blockers}`,
                        ownerId: "p-ashwin",
                        due: "2026-09-25",
                        sourceMeetingId: "rv-d0925",
                        reviewInMeetingId: "rv-w39",
                      });
                      setConverted([...converted, b.personId]);
                      toast.success("Blocker turned into a commitment", { description: "Owner Ashwin · due today · tracked in Decisions & Commitments" });
                    }}
                  >
                    {done ? <Check /> : null}
                    {done ? "Tracked" : "Own it"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {standups.map((s) => (
          <StandupCard key={s.personId} entry={s} />
        ))}
      </div>
    </div>
  );
}

function StandupCard({ entry }: { entry: StandupEntry }) {
  const update = useMgmt((s) => s.updateStandup);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry);
  const p = personById(entry.personId);
  const onLeave = p.status === "on-leave";

  return (
    <Card className={cn("flex flex-col", !entry.submitted && "border-dashed")}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <Avatar name={p.name} size="md" />
          <div>
            <CardTitle className="text-[14px]">{p.name}</CardTitle>
            <CardDescription className="mt-0">{p.role}</CardDescription>
          </div>
        </div>
        {onLeave ? (
          <Badge tone="warning">On leave</Badge>
        ) : entry.submitted ? (
          <Badge tone="success">
            <CheckCircle2 /> Submitted
          </Badge>
        ) : (
          <Badge tone="outline">Pending</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2.5 text-[12.5px]">
        {editing ? (
          <>
            {(["yesterday", "today", "blockers"] as const).map((k) => (
              <div key={k}>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k === "yesterday" ? "Yesterday — done" : k === "today" ? "Today — plan" : "Blockers"}</div>
                <Textarea value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="min-h-14 text-[12.5px]" />
              </div>
            ))}
            <div className="mt-auto flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="xs" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                variant="accent"
                size="xs"
                onClick={() => {
                  update(entry.personId, { ...draft, submitted: true });
                  setEditing(false);
                  toast.success(`${p.name.split(" ")[0]}'s stand-up submitted`);
                }}
              >
                Submit
              </Button>
            </div>
          </>
        ) : (
          <>
            <Line label="Yesterday" text={entry.yesterday} />
            <Line label="Today" text={entry.today} />
            <Line label="Blockers" text={entry.blockers || "None"} danger={!!entry.blockers} />
            <div className="mt-auto flex justify-end pt-1">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDraft(entry);
                  setEditing(true);
                }}
              >
                <Pencil /> {entry.submitted ? "Edit" : "Fill in"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Line({ label, text, danger }: { label: string; text: string; danger?: boolean }) {
  return (
    <div className="grid grid-cols-[70px_1fr] gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn(danger ? "text-danger" : "text-foreground/90", text === "None" && "text-muted-foreground")}>{text}</span>
    </div>
  );
}
