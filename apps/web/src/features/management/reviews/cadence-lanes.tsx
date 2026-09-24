"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Clock, Database, Plus, ShieldAlert, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { personById } from "@/lib/mock/core";
import { cadences, type AgendaItem, type Cadence } from "@/lib/mock/management";
import { cn } from "@/lib/utils";
import { useMgmt } from "../store";
import { CadenceLetter, fmtLong } from "./bits";

export function CadenceLanes() {
  const [open, setOpen] = useState<Cadence | null>(null);
  const meetings = useMgmt((s) => s.meetings);
  const agendas = useMgmt((s) => s.agendas);
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cadences.map((c) => {
          const next = meetings
            .filter((m) => m.cadence === c.id && m.status !== "locked")
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          const last = meetings
            .filter((m) => m.cadence === c.id && m.status === "locked")
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          const mins = agendas[c.id].reduce((s, a) => s + a.minutes, 0);
          return (
            <Card key={c.id} className={cn("flex flex-col p-5", c.mandatory && "border-gold/40")}>
              <div className="flex items-start justify-between gap-2">
                <CadenceLetter cadence={c.id} letter={c.letter} />
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge tone="outline">{c.every}</Badge>
                  {c.mandatory && (
                    <Badge tone="gold">
                      <ShieldAlert /> Mandatory
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{c.stop}</div>
                <h3 className="mt-0.5 text-[15px] font-semibold tracking-tight">{c.name}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{c.purpose}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                {c.focus.map((f) => (
                  <span key={f} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                    {f}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-[12px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {c.duration}
                  </span>
                  <span>{c.agenda.length > 0 && `${agendas[c.id].length} items · ${mins} min`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Next</span>
                  <span className="font-medium">{next ? fmtLong(next.date) : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last held</span>
                  <span>{last ? fmtLong(last.date) : "Today 9:30 AM"}</span>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between pt-4">
                <AvatarStack names={c.participantIds.map((p) => personById(p).name)} max={4} />
                <Button variant="outline" size="xs" onClick={() => setOpen(c)}>
                  Template
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <TemplateSheet cadence={open} onClose={() => setOpen(null)} />
    </>
  );
}

function TemplateSheet({ cadence, onClose }: { cadence: Cadence | null; onClose: () => void }) {
  return (
    <Dialog open={!!cadence} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right">{cadence && <TemplateEditor key={cadence.id} cadence={cadence} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function TemplateEditor({ cadence: c, onClose }: { cadence: Cadence; onClose: () => void }) {
  const saved = useMgmt((s) => s.agendas[c.id]);
  const setAgenda = useMgmt((s) => s.setAgenda);
  const [items, setItems] = useState<AgendaItem[]>(saved);
  const [blocks, setBlocks] = useState<string[]>(c.dataBlocks);
  const [draft, setDraft] = useState("");
  const total = items.reduce((s, i) => s + i.minutes, 0);

  const move = (i: number, d: -1 | 1) => {
    const n = [...items];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j]!, n[i]!];
    setItems(n);
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <CadenceLetter cadence={c.id} letter={c.letter} />
          <div>
            <DialogTitle>{c.name}</DialogTitle>
            <DialogDescription>
              {c.every} · {c.duration} · {c.schedule}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <DialogBody className="space-y-6">
        <section>
          <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Purpose</h4>
          <p className="text-[13.5px] leading-relaxed">{c.purpose}</p>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5" /> Participants · facilitator {personById(c.facilitatorId).name}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {c.participantIds.map((p) => (
              <span key={p} className="rounded-md border border-border px-2 py-0.5 text-[12px]">
                {personById(p).name}
              </span>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">Agenda template</h4>
            <span className="text-[12px] text-muted-foreground tabular">{total} min total</span>
          </div>
          <div className="space-y-1.5">
            {items.map((it, i) => (
              <div key={it.title + i} className="group flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                <span className="w-5 text-center text-[12px] font-semibold text-muted-foreground tabular">{i + 1}</span>
                <Input
                  value={it.title}
                  onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))}
                  className="h-7 flex-1 border-transparent bg-transparent px-1.5 text-[13px] hover:border-input"
                />
                <Input
                  type="number"
                  value={it.minutes}
                  onChange={(e) => setItems(items.map((x, k) => (k === i ? { ...x, minutes: Number(e.target.value) || 0 } : x)))}
                  className="h-7 w-16 px-1.5 text-right text-[12.5px] tabular"
                />
                <span className="text-[11px] text-muted-foreground">min</span>
                <div className="flex opacity-50 transition group-hover:opacity-100">
                  <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="!size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="!size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="size-7 text-danger" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label="Remove">
                    <Trash2 className="!size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                setItems([...items, { title: draft.trim(), minutes: 10 }]);
                setDraft("");
              }}
            >
              <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add agenda item…" className="h-8 text-[13px]" />
              <Button type="submit" variant="outline" size="sm">
                <Plus /> Add
              </Button>
            </form>
          </div>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            <Database className="size-3.5" /> Prefilled data blocks
          </h4>
          <p className="mb-2 text-[12px] text-muted-foreground">Pulled from live modules when the meeting opens; frozen when the record is locked.</p>
          <div className="flex flex-wrap gap-1.5">
            {c.dataBlocks.map((b) => {
              const on = blocks.includes(b);
              return (
                <button
                  key={b}
                  onClick={() => setBlocks(on ? blocks.filter((x) => x !== b) : [...blocks, b])}
                  className={cn(
                    "cursor-pointer rounded-lg border px-2.5 py-1 text-[12px] transition",
                    on ? "border-accent/40 bg-accent-soft text-accent" : "border-border text-muted-foreground line-through",
                  )}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </section>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="accent"
          onClick={() => {
            setAgenda(c.id, items);
            toast.success(`${c.name} template saved`, { description: `${items.length} agenda items · ${total} min · applies from the next meeting` });
            onClose();
          }}
        >
          Save template
        </Button>
      </DialogFooter>
    </>
  );
}
