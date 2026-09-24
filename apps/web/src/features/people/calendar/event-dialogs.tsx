"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, Clock, Lock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { useDemo } from "@/lib/store";
import { typeMeta, type CalEvent, type EventType } from "./data";

export function to12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! >= 12 ? "PM" : "AM"}`;
}

export function EventDetailsDialog({
  event,
  onClose,
  onMove,
}: {
  event: CalEvent | null;
  onClose: () => void;
  onMove: (id: string, date: string) => void;
}) {
  const [moving, setMoving] = useState(false);
  const [newDate, setNewDate] = useState("");

  return (
    <Dialog
      open={!!event}
      onOpenChange={(o) => {
        if (!o) {
          setMoving(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        {event && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: typeMeta[event.type].color }} />
                <span className="text-[12px] font-medium text-muted-foreground">{typeMeta[event.type].label.replace(/s$/, "")}</span>
                {event.locked && (
                  <Badge tone="danger">
                    <Lock /> Locked
                  </Badge>
                )}
                {event.status === "pending" && <Badge tone="warning">Pending approval</Badge>}
              </div>
              <DialogTitle>{event.title}</DialogTitle>
              <DialogDescription>{format(parseISO(event.date), "EEEE, d MMMM yyyy")}</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3 text-[13px]">
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 text-muted-foreground" />
                {event.start ? `${to12(event.start)} – ${to12(event.end ?? event.start)}` : "All day"}
                {event.type === "shoot" && event.start && <span className="text-muted-foreground">· call time {to12(event.start)}</span>}
              </div>
              {event.location && (
                <div className="flex items-center gap-2.5">
                  <MapPin className="size-4 text-muted-foreground" />
                  {event.location}
                </div>
              )}
              {event.people?.length ? (
                <div className="flex items-start gap-2.5">
                  <Users className="mt-0.5 size-4 text-muted-foreground" />
                  {event.people.join(", ")}
                </div>
              ) : null}
              {event.notes && <p className="rounded-xl bg-muted/70 p-3 text-muted-foreground">{event.notes}</p>}
              {event.locked && (
                <p className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-danger">
                  <Lock className="size-4 shrink-0" />
                  This event is locked and cannot be moved. Leave requests overlapping it need a founder exception.
                </p>
              )}
              {moving && (
                <Field label="Move to date">
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                </Field>
              )}
            </DialogBody>
            <DialogFooter>
              {event.locked ? (
                <Tooltip content="Locked event — cannot be moved">
                  <span tabIndex={0}>
                    <Button variant="outline" disabled>
                      <Lock /> Reschedule
                    </Button>
                  </span>
                </Tooltip>
              ) : moving ? (
                <>
                  <Button variant="ghost" onClick={() => setMoving(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    disabled={!newDate || newDate === event.date}
                    onClick={() => {
                      onMove(event.id, newDate);
                      toast.success(`${event.title} moved`, { description: `Now on ${format(parseISO(newDate), "EEE, d MMM")}. Attendees notified.` });
                      useDemo.getState().log(`Calendar: “${event.title}” rescheduled to ${format(parseISO(newDate), "d MMM")}`, "accent");
                      setMoving(false);
                      onClose();
                    }}
                  >
                    Save
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewDate(event.date);
                    setMoving(true);
                  }}
                >
                  <CalendarClock /> Reschedule
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const typeOptions = (["meeting", "shoot", "publish", "leave", "holiday"] as EventType[]).map((t) => ({ value: t, label: typeMeta[t].label.replace(/s$/, "") }));

export function NewEventDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate: string;
  onCreate: (e: CalEvent) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("meeting");
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("12:00");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const valid = title.trim().length > 2 && date && (allDay || start < end);

  const reset = () => {
    setTitle("");
    setType("meeting");
    setDate(defaultDate);
    setStart("11:00");
    setEnd("12:00");
    setAllDay(false);
    setLocation("");
    setNotes("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
          <DialogDescription>Adds to the company calendar and notifies attendees on WhatsApp.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Title">
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kaveri Diwali campaign — script read-through" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as EventType)} options={typeOptions} />
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[var(--accent)]" />
            All-day event
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="End">
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Conference room / Google Meet / client site" />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, prep, who should attend" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!valid}
            onClick={() => {
              onCreate({
                id: `ev-new-${Date.now()}`,
                type,
                title: title.trim(),
                date,
                start: allDay ? undefined : start,
                end: allDay ? undefined : end,
                location: location.trim() || undefined,
                notes: notes.trim() || undefined,
                people: ["Janarthanan"],
              });
              toast.success("Event added", { description: `${title.trim()} · ${format(parseISO(date), "EEE, d MMM")}${allDay ? "" : ` · ${to12(start)}`}` });
              useDemo.getState().log(`Calendar: “${title.trim()}” scheduled for ${format(parseISO(date), "d MMM")}`, "accent");
              reset();
              onOpenChange(false);
            }}
          >
            Add event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
