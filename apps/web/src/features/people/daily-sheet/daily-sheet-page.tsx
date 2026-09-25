"use client";

import { useEffect, useState } from "react";
import { Calculator, ClipboardList, Link2, PenLine, RotateCcw, ScrollText, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { useDaily } from "../daily-store";
import { SheetWorkspace } from "./sheet-workspace";
import { TeamOverview } from "./team-overview";

const perks = [
  { icon: Calculator, text: "Totals calculate themselves" },
  { icon: Link2, text: "Video IDs link to live production" },
  { icon: PenLine, text: "GM & HR sign digitally, timestamped" },
  { icon: ScrollText, text: "Feeds attendance, time & KRA" },
];

export function DailySheetPage() {
  const role = useDemo((s) => s.role);
  const [tab, setTab] = useState("sheet");
  const [personId, setPersonId] = useState(role === "hr" ? "p-harini" : "p-divya");
  const [date, setDate] = useState(TODAY);
  const reset = useDaily((s) => s.reset);

  useEffect(() => {
    useDaily.persist.rehydrate();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <ClipboardList className="size-3.5" /> People & Resources · Module 32
          </>
        }
        depth="demo"
        title="Daily Data Sheet"
        description="The paper Data Sheets every employee filled by hand — now digital. Log tasks, let the system total the hours, and route the sheet through GM and HR sign-off."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              toast("Demo sheets reset to the seeded state");
            }}
          >
            <RotateCcw /> Reset demo
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
        <Badge tone="gold" className="mr-1">
          Paper → digital
        </Badge>
        {perks.map((p) => (
          <span key={p.text} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-body text-muted-foreground">
            <p.icon className="size-3.5 text-primary" />
            {p.text}
          </span>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="sheet">
            <ClipboardList /> My sheet
          </TabsTrigger>
          <TabsTrigger value="team">
            <Users /> Team overview
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sheet">
          <SheetWorkspace personId={personId} date={date} onPerson={setPersonId} onDate={setDate} />
        </TabsContent>
        <TabsContent value="team">
          <TeamOverview
            date={date}
            onOpen={(pid, d) => {
              setPersonId(pid);
              setDate(d);
              setTab("sheet");
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
