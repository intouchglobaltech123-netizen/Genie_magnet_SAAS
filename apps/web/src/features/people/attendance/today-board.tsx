"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, Clock3, FileSpreadsheet, Fingerprint, Loader2, Palmtree, RefreshCw, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/shared/stat-card";
import { personById } from "@/lib/mock/core";
import { todayPunches, type TodayPunch } from "@/lib/mock/people";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { DEVICE, SHIFT_START, statusMeta, syncHistory, todayNotes } from "./data";

function to12h(t?: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const hh = ((h! + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, "0")} ${h! >= 12 ? "PM" : "AM"}`;
}

function nowLabel() {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
}

export function TodayBoard() {
  const [punches, setPunches] = useState<TodayPunch[]>(todayPunches);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lastSynced, setLastSynced] = useState("Today, 09:48 AM");
  const [history, setHistory] = useState(syncHistory);
  const [q, setQ] = useState("");

  const count = (s: TodayPunch["status"]) => punches.filter((p) => p.status === s).length;

  const sync = () => {
    setSyncing(true);
    setTimeout(() => {
      const label = `Today, ${nowLabel()}`;
      setSyncing(false);
      setLastSynced(label);
      setHistory((h) => [{ at: label, source: "Hikvision biometric", records: 9, by: "Manual sync · Harini Selvam" }, ...h]);
      toast.success(`Imported 9 punches from ${DEVICE}`, { description: "No new exceptions. Surya's late mark retained." });
      useDemo.getState().log("Hikvision sync — 9 punches imported (Appakudal office)", "accent");
    }, 1000);
  };

  const importExcel = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setPunches((ps) => ps.map((p) => (p.personId === "p-vignesh" ? { ...p, source: "Excel import", inTime: "06:40" } : p)));
      setHistory((h) => [{ at: `Today, ${nowLabel()}`, source: "Excel import", records: 1, by: "Harini Selvam · shoot_sheet_25sep.xlsx" }, ...h]);
      toast.success("Excel import complete", { description: "shoot_sheet_25sep.xlsx — 1 row matched (Vignesh Kumar, on-shoot 6:40 AM)" });
    }, 700);
  };

  const rows = punches.filter((p) => personById(p.personId).name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Present" value={count("present")} icon={CheckCircle2} tone="success" hint={`of ${punches.length} employees`} />
        <StatCard label="Late" value={count("late")} icon={Clock3} tone="warning" hint={`after ${to12h(SHIFT_START)}`} />
        <StatCard label="Absent" value={count("absent")} icon={UserX} tone="danger" hint="no punch, no leave" />
        <StatCard label="On leave" value={count("on-leave")} icon={Palmtree} tone="info" hint="approved in leave module" />
        <StatCard label="On shoot" value={count("on-shoot")} icon={Camera} tone="accent" hint="field attendance" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Today · Friday, 25 Sep 2026</CardTitle>
              <CardDescription>
                Shift 9:30 AM – 6:30 PM · Last synced <span className="font-medium text-foreground">{lastSynced}</span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person…" className="h-8 w-40 text-body" />
              <Button variant="outline" size="sm" onClick={importExcel} disabled={importing}>
                {importing ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                Import Excel
              </Button>
              <Button variant="accent" size="sm" onClick={sync} disabled={syncing}>
                {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {syncing ? "Syncing…" : "Sync Hikvision"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <ul className="divide-y divide-border">
              {rows.map((p) => {
                const person = personById(p.personId);
                const meta = statusMeta[p.status];
                return (
                  <li key={p.personId} className="flex items-center gap-3 px-5 py-3 text-body">
                    <Avatar name={person.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{person.name}</div>
                      <div className="truncate text-body text-muted-foreground">{todayNotes[p.personId] ?? person.role}</div>
                    </div>
                    <div className="hidden w-24 text-right sm:block">
                      <div className="text-body uppercase tracking-wider text-muted-foreground">In</div>
                      <div className={cn("tabular font-medium", p.status === "late" && "text-warning")}>{to12h(p.inTime)}</div>
                    </div>
                    <div className="hidden w-40 md:flex md:justify-end">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-body text-muted-foreground",
                          p.source === "Hikvision biometric" && "border-primary/30 text-primary",
                        )}
                      >
                        {p.source === "Hikvision biometric" ? <Fingerprint className="size-3" /> : p.source === "Excel import" ? <FileSpreadsheet className="size-3" /> : <Palmtree className="size-3" />}
                        {p.source}
                      </span>
                    </div>
                    <div className="w-20 text-right">
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
              {!rows.length && <li className="px-5 py-8 text-center text-body text-muted-foreground">No one matches “{q}”.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Import log</CardTitle>
              <CardDescription>Biometric + field sheets</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {history.slice(0, 6).map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex gap-3 text-body">
                  <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg", h.source === "Excel import" ? "bg-success-soft text-success" : "bg-primary-soft text-primary")}>
                    {h.source === "Excel import" ? <FileSpreadsheet className="size-3.5" /> : <Fingerprint className="size-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium">
                      {h.records} {h.records === 1 ? "record" : "records"} · {h.source}
                    </div>
                    <div className="truncate text-body text-muted-foreground">{h.by}</div>
                    <div className="text-body text-muted-foreground">{h.at}</div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-xl bg-muted/60 p-3 text-body text-muted-foreground">
              Device <span className="font-medium text-foreground">{DEVICE}</span> · online · firmware V3.2.30
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
