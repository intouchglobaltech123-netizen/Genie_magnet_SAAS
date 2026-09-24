"use client";

import { toast } from "sonner";
import { CalendarPlus, PartyPopper } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { employees, TODAY } from "@/lib/mock/core";
import { holidays, leaveEntitlement } from "@/lib/mock/people";
import { cn } from "@/lib/utils";

type Bal = { CL: number; SL: number; EL: number };

function BalCell({ left, of }: { left: number; of: number }) {
  const ratio = left / of;
  return (
    <div className="w-32">
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="tabular font-semibold">{left}</span>
        <span className="tabular text-muted-foreground">of {of}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", ratio <= 0.25 ? "bg-danger" : ratio <= 0.5 ? "bg-warning" : "bg-success")}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(`${TODAY}T00:00:00`).getTime()) / 86400000);

export function BalancesAndHolidays({ balances }: { balances: Record<string, Bal> }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Leave balances · FY 2026–27</CardTitle>
            <CardDescription>
              Entitlement: CL {leaveEntitlement.CL} · SL {leaveEntitlement.SL} · EL {leaveEntitlement.EL} per year. EL carries forward up to 30 days.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <THead>
              <TR>
                <TH className="pl-5">Employee</TH>
                <TH>Casual (CL)</TH>
                <TH>Sick (SL)</TH>
                <TH>Earned (EL)</TH>
                <TH className="pr-5 text-right">Total left</TH>
              </TR>
            </THead>
            <TBody>
              {employees.map((e) => {
                const b = balances[e.id] ?? { CL: 0, SL: 0, EL: 0 };
                const total = b.CL + b.SL + b.EL;
                return (
                  <TR key={e.id}>
                    <TD className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} size="sm" />
                        <div>
                          <div className="font-medium">{e.name}</div>
                          <div className="text-[11.5px] text-muted-foreground">{e.role}</div>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <BalCell left={b.CL} of={leaveEntitlement.CL} />
                    </TD>
                    <TD>
                      <BalCell left={b.SL} of={leaveEntitlement.SL} />
                    </TD>
                    <TD>
                      <BalCell left={b.EL} of={leaveEntitlement.EL} />
                    </TD>
                    <TD className="tabular pr-5 text-right font-semibold">{total}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tamil Nadu holidays</CardTitle>
            <CardDescription>Company calendar 2026 · Sep – Dec</CardDescription>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => toast.success("Holiday list shared", { description: "Added to 10 employee Google Calendars as all-day events." })}
          >
            <CalendarPlus className="size-3.5" /> Sync
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {holidays.map((h) => {
              const d = new Date(`${h.date}T00:00:00`);
              const away = daysUntil(h.date);
              const past = away < 0;
              return (
                <li key={h.date} className={cn("flex items-center gap-3 rounded-xl border border-border p-3", past && "opacity-55")}>
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-lg bg-gold-soft py-1 text-gold">
                    <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                    <span className="tabular text-[17px] font-semibold leading-none">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium">
                      {h.name === "Deepavali" && <PartyPopper className="size-3.5 text-gold" />}
                      {h.name}
                    </div>
                    <div className="text-[12px] text-muted-foreground">{d.toLocaleDateString("en-IN", { weekday: "long" })}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={h.kind === "National" ? "info" : h.kind === "State (TN)" ? "accent" : "gold"}>{h.kind}</Badge>
                    <span className="tabular text-[11px] text-muted-foreground">{past ? "Done" : away === 0 ? "Today" : `in ${away} days`}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
