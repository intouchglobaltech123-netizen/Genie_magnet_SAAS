"use client";

import { useEffect, useState } from "react";
import { BarChart3, Brain, CalendarDays, Database, FileSpreadsheet, ListPlus, LockKeyhole, RotateCcw, Settings2, Trophy, Trash } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlanner } from "@/features/planner/store";
import { SetupTab } from "@/features/planner/setup-tab";
import { LogTab } from "@/features/planner/log-tab";
import { MonthlyTab, WeeklyTab } from "@/features/planner/summary-tabs";
import { QuizTab } from "@/features/planner/quiz-tab";
import { ProfileTab } from "@/features/planner/profile-tab";
import { WTF_TOOL } from "@/lib/mock/planner";

export function PlannerView() {
  const [tab, setTab] = useState("setup");
  const loadLog = usePlanner((s) => s.loadLog);
  const resetAll = usePlanner((s) => s.resetAll);

  useEffect(() => {
    usePlanner.persist.rehydrate();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-accent-strong">{WTF_TOOL.name}</span>
            <span>· by {WTF_TOOL.author}</span>
          </span>
        }
        depth="demo"
        title="Financial Planner"
        description="Personal Leakage Auditor and Money Behaviour Diagnostic — find where your money leaks, what it costs your retirement, and the beliefs behind it."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Database /> Sample data
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem
                  onSelect={() => {
                    loadLog("demo");
                    toast.success("Loaded Arun's September", { description: "26 spends across 25 days" });
                  }}
                >
                  <CalendarDays /> Demo month (26 entries)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    loadLog("workbook");
                    toast.success("Loaded the workbook sample", { description: "3 entries · SIP ₹20,000 — reconciles to the Excel report" });
                  }}
                >
                  <FileSpreadsheet /> Workbook sample (reconciles with Excel)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    loadLog("empty");
                    toast("Daily log cleared");
                  }}
                >
                  <Trash /> Start an empty month
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetAll();
                setTab("setup");
                toast("Planner reset to demo data");
              }}
            >
              <RotateCcw /> Reset
            </Button>
          </>
        }
      />

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success">
          <LockKeyhole className="size-3.5" />
        </span>
        <div className="text-body">
          <span className="font-medium">Private to you.</span>{" "}
          <span className="text-muted-foreground">
            Personal-finance entries are visible only to the employee who owns them. This module has its own permission, separate from company finance — managers, HR and
            Finance cannot open it, and nothing here feeds payroll or reports.
          </span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList>
            <TabsTrigger value="setup">
              <Settings2 /> My Setup
            </TabsTrigger>
            <TabsTrigger value="log">
              <ListPlus /> Daily Log
            </TabsTrigger>
            <TabsTrigger value="weekly">
              <CalendarDays /> Weekly Summary
            </TabsTrigger>
            <TabsTrigger value="monthly">
              <Trophy /> Monthly Report
            </TabsTrigger>
            <TabsTrigger value="quiz">
              <BarChart3 /> Money Diagnostic
            </TabsTrigger>
            <TabsTrigger value="profile">
              <Brain /> My Money Profile
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="setup">
          <SetupTab />
        </TabsContent>
        <TabsContent value="log">
          <LogTab />
        </TabsContent>
        <TabsContent value="weekly">
          <WeeklyTab />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyTab />
        </TabsContent>
        <TabsContent value="quiz">
          <QuizTab onFinish={() => setTab("profile")} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileTab onStartQuiz={() => setTab("quiz")} />
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-body text-muted-foreground">
        <span>
          {WTF_TOOL.name} · {WTF_TOOL.site} · used in the {WTF_TOOL.community}
        </span>
        <span>Figures are educational estimates, not investment advice.</span>
      </div>
    </>
  );
}
