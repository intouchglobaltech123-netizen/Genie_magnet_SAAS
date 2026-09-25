"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, Inbox, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { leaveBalances, leaveRequests, type LeaveRequest } from "@/lib/mock/people";
import { TodayBoard } from "./today-board";
import { MonthGrid } from "./month-grid";
import { LeaveRequests } from "./leave-requests";
import { BalancesAndHolidays } from "./balances";

export function AttendanceView() {
  const [requests, setRequests] = useState<LeaveRequest[]>(leaveRequests);
  const [balances, setBalances] = useState(leaveBalances);
  const pending = requests.filter((r) => r.status === "pending").length;

  const onDecide = (id: string, status: "approved" | "rejected", exceptionReason?: string) => {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setRequests((rs) =>
      rs.map((x) => (x.id === id ? { ...x, status, exceptionReason, approver: "Janarthanan", decidedOn: new Date().toISOString() } : x)),
    );
    if (status === "approved" && r.type !== "LOP") {
      const type = r.type;
      setBalances((b) => {
        const cur = b[r.personId];
        return cur ? { ...b, [r.personId]: { ...cur, [type]: Math.max(0, cur[type] - r.days) } } : b;
      });
    }
  };

  return (
    <Tabs defaultValue="today">
      <TabsList>
        <TabsTrigger value="today">
          <CalendarDays /> Today
        </TabsTrigger>
        <TabsTrigger value="month">
          <CalendarRange /> Month
        </TabsTrigger>
        <TabsTrigger value="leave">
          <Inbox /> Leave requests
          {pending > 0 && <Badge tone="warning" className="tabular ml-0.5 px-1.5">{pending}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="balances">
          <Wallet /> Balances & holidays
        </TabsTrigger>
      </TabsList>
      <TabsContent value="today" className="mt-6">
        <TodayBoard />
      </TabsContent>
      <TabsContent value="month" className="mt-6">
        <MonthGrid requests={requests} />
      </TabsContent>
      <TabsContent value="leave" className="mt-6">
        <LeaveRequests requests={requests} onDecide={onDecide} />
      </TabsContent>
      <TabsContent value="balances" className="mt-6">
        <BalancesAndHolidays balances={balances} />
      </TabsContent>
    </Tabs>
  );
}
