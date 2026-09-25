"use client";

import * as React from "react";
import { AlertOctagon, CalendarCheck, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { personById } from "@/lib/mock/core";
import type { Asset } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { ALTERNATIVES, RESERVE_PEOPLE, type Reservation } from "./data";

export function ReserveDialog({
  open,
  onOpenChange,
  assets,
  initialTag,
  reservations,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assets: Asset[];
  initialTag: string;
  reservations: Reservation[];
  onConfirm: (r: Omit<Reservation, "id">) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && <ReserveForm key={initialTag} assets={assets} initialTag={initialTag} reservations={reservations} onConfirm={onConfirm} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ReserveForm({
  assets,
  initialTag,
  reservations,
  onConfirm,
  onCancel,
}: {
  assets: Asset[];
  initialTag: string;
  reservations: Reservation[];
  onConfirm: (r: Omit<Reservation, "id">) => void;
  onCancel: () => void;
}) {
  const [tag, setTag] = React.useState(initialTag);
  const [date, setDate] = React.useState("2026-09-27");
  const [purpose, setPurpose] = React.useState("Kaveri — Testimonial pickups");
  const [personId, setPersonId] = React.useState("f-gokul");

  const asset = assets.find((a) => a.tag === tag);
  const conflict = reservations.find((r) => r.tag === tag && r.date === date);
  const altTag = ALTERNATIVES[tag];
  const alt = assets.find((a) => a.tag === altTag && a.status !== "maintenance" && a.status !== "retired");
  const altFree = alt && !reservations.some((r) => r.tag === alt.tag && r.date === date);
  const inMaintenance = asset?.status === "maintenance";
  const canConfirm = !!asset && !!date && purpose.trim().length > 2 && !conflict && !inMaintenance;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Reserve equipment</DialogTitle>
        <DialogDescription>Hold gear for a shoot. Clashes with existing bookings are blocked automatically.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Asset">
          <Select
            value={tag}
            onValueChange={setTag}
            options={assets
              .filter((a) => a.category !== "Computer" && a.category !== "Storage")
              .map((a) => ({ value: a.tag, label: `${a.tag} · ${a.name}` }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} min="2026-09-25" onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Reserved for">
            <Select value={personId} onValueChange={setPersonId} options={RESERVE_PEOPLE.map((id) => ({ value: id, label: personById(id).name }))} />
          </Field>
        </div>
        <Field label="Shoot / purpose">
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Nova Dental — Testimonials" />
        </Field>

        {conflict ? (
          <div className="rounded-xl border border-danger/30 bg-danger-soft p-3.5 text-body">
            <div className="flex items-start gap-2 text-danger">
              <AlertOctagon className="mt-0.5 size-4 shrink-0" />
              <div>
                <div className="font-semibold">Conflict — {tag} is already booked on {fmtDate(date, { day: "numeric", month: "short" })}</div>
                <div className="mt-0.5 text-foreground/80">
                  {conflict.purpose}
                  {conflict.location ? ` · ${conflict.location}` : ""} · {personById(conflict.personId).name}
                </div>
              </div>
            </div>
            {alt && altFree && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2">
                <span className="flex items-center gap-1.5 text-body">
                  <Sparkles className="size-3.5 text-primary" />
                  Suggest alternative: <b>{alt.tag}</b> {alt.name} available
                </span>
                <Button size="xs" variant="soft" onClick={() => setTag(alt.tag)}>
                  Use {alt.tag}
                </Button>
              </div>
            )}
          </div>
        ) : inMaintenance ? (
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-body text-warning">
            <AlertOctagon className="mt-0.5 size-4 shrink-0" /> This asset is under maintenance and can&apos;t be reserved.
          </div>
        ) : asset && date ? (
          <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success-soft p-3 text-body text-success">
            <CheckCircle2 className="size-4" /> {asset.tag} is free on {fmtDate(date, { day: "numeric", month: "short", year: "numeric" })}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="accent"
          size="sm"
          disabled={!canConfirm}
          onClick={() => onConfirm({ tag, date, purpose: purpose.trim(), personId })}
        >
          <CalendarCheck /> Confirm reservation
        </Button>
      </DialogFooter>
    </>
  );
}
