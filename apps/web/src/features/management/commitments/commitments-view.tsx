"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, ClipboardList, Plus, Repeat, RotateCcw, Search, SearchX, Siren } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { daysBetween, employees, personById, TODAY } from "@/lib/mock/core";
import { cadenceById, cadences, FOLLOWING_STRATEGIC_LABEL } from "@/lib/mock/management";
import { cn, fmtDate } from "@/lib/utils";
import { commitmentState, isEscalated, useMgmt } from "../store";
import { cadenceTone } from "../reviews/bits";

type Filter = "all" | "open" | "overdue" | "done" | "carried" | "escalated";

export function CommitmentsView() {
  const commitments = useMgmt((s) => s.commitments);
  const meetings = useMgmt((s) => s.meetings);
  const setDone = useMgmt((s) => s.setDone);
  const createTask = useMgmt((s) => s.createTask);
  const [filter, setFilter] = useState<Filter>("all");
  const [owner, setOwner] = useState("all");
  const [cad, setCad] = useState("all");
  const [q, setQ] = useState("");

  const meetingOf = (id: string) => meetings.find((m) => m.id === id);
  const rows = commitments
    .filter((c) => {
      const st = commitmentState(c);
      if (filter === "open" && st !== "open") return false;
      if (filter === "overdue" && st !== "overdue") return false;
      if (filter === "done" && st !== "done") return false;
      if (filter === "carried" && !(c.carried > 0 && st !== "done")) return false;
      if (filter === "escalated" && !isEscalated(c)) return false;
      if (owner !== "all" && c.ownerId !== owner) return false;
      if (cad !== "all" && meetingOf(c.sourceMeetingId)?.cadence !== cad) return false;
      if (q && !c.text.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const rank = { overdue: 0, open: 1, done: 2 };
      return rank[commitmentState(a)] - rank[commitmentState(b)] || a.due.localeCompare(b.due);
    });

  const filtering = filter !== "all" || owner !== "all" || cad !== "all" || q.trim() !== "";
  const clearFilters = () => {
    setFilter("all");
    setOwner("all");
    setCad("all");
    setQ("");
  };

  const count = (f: (c: (typeof commitments)[number]) => boolean) => commitments.filter(f).length;
  const openN = count((c) => commitmentState(c) === "open");
  const overdueN = count((c) => commitmentState(c) === "overdue");
  const doneN = count((c) => c.status === "done");
  const carriedN = count((c) => c.carried > 0 && c.status !== "done");
  const escN = count(isEscalated);

  const chips: { k: Filter; label: string; n: number }[] = [
    { k: "all", label: "All", n: commitments.length },
    { k: "open", label: "Open", n: openN },
    { k: "overdue", label: "Overdue", n: overdueN },
    { k: "carried", label: "Carried forward", n: carriedN },
    { k: "escalated", label: "Escalated", n: escN },
    { k: "done", label: "Done", n: doneN },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management · Module 41"
        depth="preview"
        title="Decisions & Commitments"
        description="Every decision from every review becomes a commitment with one owner and a due date. Unfinished ones carry forward — and escalate — automatically."
        className="mb-0"
        actions={<NewCommitment />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={openN} icon={CircleDot} tone="accent" hint="on track, not yet due" />
        <StatCard label="Overdue" value={overdueN} icon={AlertTriangle} tone="danger" hint="past due date, still open" />
        <StatCard label="Carried forward" value={carriedN} icon={Repeat} tone="warning" hint={`${escN} escalated to founder`} />
        <StatCard label="Completion rate" value={`${Math.round((doneN / commitments.length) * 100)}%`} icon={CheckCircle2} tone="success" hint={`${doneN} of ${commitments.length} done`} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
          <div className="flex flex-wrap gap-1">
            {chips.map((c) => (
              <button
                key={c.k}
                type="button"
                aria-pressed={filter === c.k}
                onClick={() => setFilter(c.k)}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-body font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                  filter === c.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {c.label} <span className="ml-0.5 opacity-60 tabular">{c.n}</span>
              </button>
            ))}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <div className="relative w-full sm:w-44">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search commitments" className="h-8 w-full pl-8 text-body" />
            </div>
            <Select
              value={owner}
              onValueChange={setOwner}
              className="h-8 w-full text-body sm:w-40"
              options={[{ value: "all", label: "All owners" }, ...employees.map((p) => ({ value: p.id, label: p.name }))]}
            />
            <Select
              value={cad}
              onValueChange={setCad}
              className="h-8 w-full text-body sm:w-40"
              options={[{ value: "all", label: "All sources" }, ...cadences.map((c) => ({ value: c.id, label: `${c.every} reviews` }))]}
            />
          </div>
        </div>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Commitment</TH>
              <TH>Owner</TH>
              <TH>Due</TH>
              <TH>Source meeting</TH>
              <TH>Status</TH>
              <TH className="pr-5 text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((c) => {
              const st = commitmentState(c);
              const p = personById(c.ownerId);
              const src = meetingOf(c.sourceMeetingId);
              const late = st === "overdue" ? daysBetween(c.due, TODAY) : 0;
              const esc = isEscalated(c);
              return (
                <TR key={c.id} className={cn(esc && "bg-danger-soft/30 hover:bg-danger-soft/40")}>
                  <TD className="max-w-md pl-5">
                    <div className={cn("font-medium leading-snug", st === "done" && "text-muted-foreground line-through")}>{c.text}</div>
                    {c.markNote && <div className="mt-0.5 truncate text-body text-muted-foreground">{c.markNote}</div>}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Avatar name={p.name} size="sm" />
                      {p.name}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <div className={cn("tabular", st === "overdue" && "font-medium text-danger")}>{fmtDate(c.due, { day: "numeric", month: "short", year: "numeric" })}</div>
                    {late > 0 && <div className="text-body text-danger">{late} day{late > 1 ? "s" : ""} late</div>}
                  </TD>
                  <TD>
                    {src ? (
                      <Link href={`/reviews/${src.id}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                        <Badge tone={cadenceTone[src.cadence]}>{cadenceById(src.cadence).every}</Badge>
                        <span className="text-body">{src.title.replace("45-Day ", "").replace("Weekly Agency Review · ", "Weekly ")}</span>
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={st === "done" ? "Done" : st === "overdue" ? "Overdue" : "Open"} />
                      {c.carried > 0 && st !== "done" && (
                        <Tooltip content={`Not completed in ${c.carried} review${c.carried > 1 ? "s" : ""}; next check: ${c.reviewInMeetingId === "rv-s8" ? FOLLOWING_STRATEGIC_LABEL : meetingOf(c.reviewInMeetingId)?.title ?? "next review"}`}>
                          <span>
                            <Badge tone="warning">
                              <Repeat /> Carried ×{c.carried}
                            </Badge>
                          </span>
                        </Tooltip>
                      )}
                      {esc && (
                        <Tooltip content="Escalated: carried forward 2+ times or more than 7 days overdue — raised to Janarthanan">
                          <span>
                            <Badge tone="danger">
                              <Siren /> Escalated
                            </Badge>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </TD>
                  <TD className="pr-5">
                    <div className="flex justify-end gap-1.5">
                      {st !== "done" && !c.taskCreated && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            createTask(c.id);
                            toast.success("Task created", { description: `Assigned to ${p.name} · due ${fmtDate(c.due)}` });
                          }}
                        >
                          <ClipboardList /> Task
                        </Button>
                      )}
                      {st === "done" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setDone(c.id, false);
                            toast("Commitment reopened");
                          }}
                        >
                          <RotateCcw /> Reopen
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setDone(c.id, true);
                            toast.success("Marked done", { description: c.text });
                          }}
                        >
                          <CheckCircle2 /> Mark done
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {rows.length === 0 && (
          <div className="p-5">
            <EmptyState
              compact
              icon={SearchX}
              title={filtering ? "No commitments match these filters" : "No commitments yet"}
              description={filtering ? "Try another status, owner or source, or clear the search." : "Decisions recorded in reviews appear here with an owner and due date."}
              action={
                filtering ? (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function NewCommitment() {
  const [open, setOpen] = useState(false);
  const meetings = useMgmt((s) => s.meetings);
  const add = useMgmt((s) => s.addCommitment);
  const [f, setF] = useState({ text: "", ownerId: "p-ashwin", due: "2026-10-10", source: "rv-t19" });
  return (
    <>
      <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
        <Plus /> New commitment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a commitment</DialogTitle>
            <DialogDescription>One owner, one due date, linked to the meeting where it was decided.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Commitment" required>
              <Textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} placeholder="e.g. Send revised Balaji Textiles proposal at 10% discount" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Owner">
                <Select value={f.ownerId} onValueChange={(v) => setF({ ...f, ownerId: v })} options={employees.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
              <Field label="Due date">
                <Input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
              </Field>
            </div>
            <Field label="Source meeting">
              <Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })} options={meetings.map((m) => ({ value: m.id, label: m.title }))} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!f.text.trim()}
              onClick={() => {
                const src = meetings.find((m) => m.id === f.source)!;
                const next = meetings.filter((m) => m.cadence === src.cadence && m.date > src.date).sort((a, b) => a.date.localeCompare(b.date))[0];
                add({ text: f.text.trim(), ownerId: f.ownerId, due: f.due, sourceMeetingId: f.source, reviewInMeetingId: next?.id ?? f.source });
                toast.success("Commitment recorded", { description: `${personById(f.ownerId).name} · due ${fmtDate(f.due)}` });
                setOpen(false);
                setF({ ...f, text: "" });
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
