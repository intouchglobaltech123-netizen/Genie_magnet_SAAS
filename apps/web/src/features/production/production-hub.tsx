"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Clapperboard, Download, Film, Hourglass, KanbanSquare, Plus, Search, Sheet, Timer, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { clients, daysBetween, editors, isOverdue, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Urgency } from "@/lib/types";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ACTIVE_STAGES, avgTurnaround, isDone } from "./lib";
import { NewVideoDialog } from "./new-video-dialog";
import { SheetView } from "./sheet-view";
import { useProductionHydration } from "./store";

export function ProductionHub() {
  useProductionHydration();
  const all = useDemo((s) => s.videos);
  const [view, setView] = useState("board");
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [editor, setEditor] = useState("all");
  const [urgency, setUrgency] = useState<"all" | Urgency>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [newDue, setNewDue] = useState<string | undefined>();

  const videos = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .filter((v) => client === "all" || v.clientId === client)
      .filter((v) => editor === "all" || v.editorId === editor)
      .filter((v) => urgency === "all" || v.urgency === urgency)
      .filter((v) => !needle || v.title.toLowerCase().includes(needle) || v.code.toLowerCase().includes(needle) || v.clipNo.toLowerCase().includes(needle));
  }, [all, q, client, editor, urgency]);

  const stats = useMemo(() => {
    const active = all.filter((v) => ACTIVE_STAGES.includes(v.stage));
    const week = all.filter((v) => !isDone(v) && daysBetween(TODAY, v.dueDate) >= 0 && daysBetween(TODAY, v.dueDate) <= 7);
    return {
      active: active.length,
      week: week.length,
      overdue: all.filter(isOverdue).length,
      awaiting: all.filter((v) => v.stage === "Client Review").length,
      tat: avgTurnaround(all),
      rush: active.filter((v) => v.urgency === "rush").length,
    };
  }, [all]);

  const filtersOn = q || client !== "all" || editor !== "all" || urgency !== "all";

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <Film className="size-3.5" /> Client Delivery · Module 15
          </span>
        }
        title="Video Production"
        description="Every video from brief to publish — the video list sheet, shoot batches, editing data sheet and client delivery in one calendar."
        actions={
          <>
            <Button variant="outline" onClick={() => toast.success("Export started", { description: "Sep 2026 video list (CSV) will download shortly." })}>
              <Download /> Export
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setNewDue(undefined);
                setNewOpen(true);
              }}
            >
              <Plus /> New video
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="In production" value={stats.active} icon={Clapperboard} hint={`${stats.rush} rush`} tone="accent" />
        <StatCard label="Due this week" value={stats.week} icon={CalendarDays} hint="next 7 days" tone="info" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} hint="past due, not approved" tone="danger" />
        <StatCard label="Awaiting client" value={stats.awaiting} icon={UserRoundCheck} hint="in client review" tone="warning" />
        <StatCard label="Avg turnaround" value={`${stats.tat.toFixed(1)}d`} icon={Timer} delta={-0.14} deltaLabel="vs Aug" tone="success" />
      </div>

      <Tabs value={view} onValueChange={setView}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="board">
              <KanbanSquare /> Board
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays /> Calendar
            </TabsTrigger>
            <TabsTrigger value="sheet">
              <Sheet /> Sheet
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search videos" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, title, clip…" className="h-8 w-full pl-8" />
            </div>
            <Select
              className="h-8 w-40"
              value={client}
              onValueChange={setClient}
              options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select
              className="h-8 w-40"
              value={editor}
              onValueChange={setEditor}
              options={[{ value: "all", label: "All editors" }, ...editors.map((e) => ({ value: e.id, label: e.name }))]}
            />
            <Select
              className="h-8 w-32"
              value={urgency}
              onValueChange={(u) => setUrgency(u as "all" | Urgency)}
              options={[
                { value: "all", label: "Any urgency" },
                { value: "rush", label: "Rush" },
                { value: "priority", label: "Priority" },
                { value: "standard", label: "Standard" },
              ]}
            />
            {filtersOn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setClient("all");
                  setEditor("all");
                  setUrgency("all");
                }}
              >
                <X /> Clear
              </Button>
            )}
          </div>
        </div>
        {filtersOn && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-body text-muted-foreground">
            <Hourglass className="size-3.5" /> Showing {videos.length} of {all.length} videos
          </div>
        )}
        <TabsContent value="board">
          <BoardView videos={videos} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarView
            videos={videos}
            clientFilter={client}
            onNew={(d) => {
              setNewDue(d);
              setNewOpen(true);
            }}
          />
        </TabsContent>
        <TabsContent value="sheet">
          <SheetView videos={videos} />
        </TabsContent>
      </Tabs>

      <NewVideoDialog key={newDue ?? "default"} open={newOpen} onOpenChange={setNewOpen} defaultDue={newDue} />
    </div>
  );
}
