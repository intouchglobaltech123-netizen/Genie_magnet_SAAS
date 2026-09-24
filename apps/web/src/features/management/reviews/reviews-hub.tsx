"use client";

import { useState } from "react";
import { CalendarPlus, LayoutGrid, Sun, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cadenceById, cadences, type CadenceId } from "@/lib/mock/management";
import { useMgmt } from "../store";
import { CadenceLanes } from "./cadence-lanes";
import { PastReviews, StrategicHero, UpcomingSchedule } from "./overview";
import { DailyStandup } from "./standup";
import { WeeklyReview } from "./weekly";

export function ReviewsHub() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Management · Module 40 · STOP system"
        depth="demo"
        title="Reviews & Meetings"
        description="Strategic, Tactical and Operational reviews on a fixed rhythm — every meeting ends in owned commitments, and every record is locked once closed."
        className="mb-0"
        actions={<ScheduleButton />}
      />
      <Tabs defaultValue="overview">
        <TabsList className="scrollbar-thin max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">
            <LayoutGrid /> Overview
          </TabsTrigger>
          <TabsTrigger value="daily">
            <Sun /> Daily stand-up
          </TabsTrigger>
          <TabsTrigger value="weekly">
            <CalendarRange /> Weekly review
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <StrategicHero />
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold tracking-tight">Review cadences</h2>
              <span className="text-[12.5px] text-muted-foreground">Daily · 7-day · 14-day · 45-day — all four included in V1</span>
            </div>
            <CadenceLanes />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <UpcomingSchedule />
            <PastReviews />
          </div>
        </TabsContent>
        <TabsContent value="daily">
          <DailyStandup />
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklyReview />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScheduleButton() {
  const [open, setOpen] = useState(false);
  const [cadence, setCadence] = useState<CadenceId>("tactical");
  const [date, setDate] = useState("2026-10-17");
  const [time, setTime] = useState("10:00");
  const meetings = useMgmt((s) => s.meetings);
  const schedule = useMgmt((s) => s.scheduleMeeting);
  const c = cadenceById(cadence);
  const nextNo = Math.max(0, ...meetings.filter((m) => m.cadence === cadence).map((m) => m.number)) + 1;
  const title =
    cadence === "strategic" ? `45-Day Strategic Review #${nextNo}` : cadence === "tactical" ? `Tactical Review #${nextNo}` : cadence === "weekly" ? `Weekly Agency Review #${nextNo}` : "Daily Stand-up";

  return (
    <>
      <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus /> Schedule review
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a review</DialogTitle>
            <DialogDescription>Agenda template and data blocks are copied from the cadence settings.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Cadence">
              <Select
                value={cadence}
                onValueChange={(v) => setCadence(v as CadenceId)}
                options={cadences.map((x) => ({ value: x.id, label: `${x.every} · ${x.name}` }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Start time">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            </div>
            <div className="rounded-xl bg-muted/60 p-3 text-[12.5px]">
              <div className="font-medium">{title}</div>
              <div className="mt-0.5 text-muted-foreground">
                {c.duration} · {c.participantIds.length} participants · {c.agenda.length} agenda items · calendar invites go to everyone
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                schedule({
                  cadence,
                  number: nextNo,
                  title,
                  date: `${date}T${time}:00`,
                  end: c.id === "strategic" ? "18:00" : "12:00",
                  venue: "Genie Magnet studio, Appakudal",
                  facilitatorId: c.facilitatorId,
                  attendeeIds: c.participantIds,
                });
                toast.success(`${title} scheduled`, { description: `${new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${time} · invites queued for ${c.participantIds.length} people` });
                setOpen(false);
              }}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
