"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, FileSignature, Layers, Plus, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CategoryBadge } from "@/components/shared/video-bits";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { clientById, clients, daysBetween, personById, TODAY } from "@/lib/mock/core";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { periodProgress, StatusBadge, unitsTotal, useAgreements } from "./shared";

export function AgreementsList() {
  const params = useSearchParams();
  const router = useRouter();
  const clientFilter = params.get("client");
  const all = useAgreements();
  const list = clientFilter ? all.filter((a) => a.clientId === clientFilter) : all;
  const live = all.filter((a) => a.status === "active" || a.status === "renewal-due");
  const mrr = live.reduce((s, a) => s + a.monthlyFee, 0);
  const renewals = all.filter((a) => a.status === "renewal-due" || daysBetween(TODAY, a.endDate) <= 60);
  const units = live.reduce((s, a) => s + unitsTotal(a), 0);
  const filterClient = clientFilter ? clients.find((c) => c.id === clientFilter) : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Module 10 · Agreements & Packages"
        title="Agreements"
        description="What we promised each client — units per cycle, revision allowance, turnaround and billing terms. The source of truth for cycles and billing."
        actions={
          <Button variant="accent" size="sm" onClick={() => toast("New agreement", { description: "Start from a won deal in CRM, or pick a package template" })}>
            <Plus /> New agreement
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active agreements" value={live.length} icon={FileSignature} tone="accent" hint={`${all.length} total`} />
        <StatCard label="Contracted MRR" value={inrCompact(mrr)} icon={Wallet} tone="success" hint="per month, ex-GST" />
        <StatCard label="Units promised / cycle" value={units} icon={Layers} tone="info" hint="across all clients" />
        <StatCard label="Renewals in 60 days" value={renewals.length} icon={CalendarClock} tone="warning" hint={renewals.map((r) => clientById(r.clientId).code).join(" · ") || "none"} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => router.push("/agreements")}
          className={cn(
            "h-7 cursor-pointer rounded-full border px-3 text-body font-medium transition",
            !clientFilter ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          All clients
        </button>
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/agreements?client=${c.id}`)}
            className={cn(
              "h-7 cursor-pointer rounded-full border px-3 text-body font-medium transition",
              clientFilter === c.id ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.name}
          </button>
        ))}
        {filterClient && (
          <Button variant="ghost" size="xs" onClick={() => router.push("/agreements")}>
            <X /> Clear
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Agreement</TH>
              <TH>Package</TH>
              <TH>Status</TH>
              <TH className="text-right">Monthly fee</TH>
              <TH className="min-w-48">Period</TH>
              <TH className="text-right">Units / cycle</TH>
              <TH className="pr-5">Owner</TH>
            </TR>
          </THead>
          <TBody>
            {list.map((a) => {
              const c = clientById(a.clientId);
              const owner = personById(c.accountOwnerId);
              const p = periodProgress(a);
              const left = daysBetween(TODAY, a.endDate);
              return (
                <TR key={a.id} className="cursor-pointer" onClick={() => router.push(`/agreements/${a.id}`)}>
                  <TD className="pl-5">
                    <Link href={`/agreements/${a.id}`} className="block" onClick={(e) => e.stopPropagation()}>
                      <div className="text-body font-semibold hover:text-primary">{c.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-body text-muted-foreground">
                        <CategoryBadge category={c.category} />
                        <span>{c.kind === "partner" ? "Partner client" : "Recurring"}</span>
                      </div>
                    </Link>
                  </TD>
                  <TD>
                    <div className="font-medium">{a.packageName}</div>
                    <div className="text-body text-muted-foreground">{a.service}</div>
                  </TD>
                  <TD>
                    <StatusBadge status={a.status} />
                  </TD>
                  <TD className="text-right">
                    <div className="font-semibold tabular">{inr(a.monthlyFee)}</div>
                    <div className="text-body text-muted-foreground">{a.billing}</div>
                  </TD>
                  <TD>
                    <Progress value={p * 100} tone={left <= 45 ? "warning" : "accent"} />
                    <div className="mt-1 flex justify-between text-body text-muted-foreground tabular">
                      <span>{fmtDate(a.startDate, { month: "short", year: "2-digit" })}</span>
                      <span className={cn(left <= 45 && "font-medium text-warning")}>{left}d left</span>
                      <span>{fmtDate(a.endDate, { month: "short", year: "2-digit" })}</span>
                    </div>
                  </TD>
                  <TD className="text-right">
                    <div className="text-subheading font-semibold tabular">{unitsTotal(a)}</div>
                    <div className="max-w-44 truncate text-body text-muted-foreground" title={a.units.map((u) => `${u.perCycle} ${u.label}`).join(", ")}>
                      {a.units.map((u) => `${u.perCycle} ${u.label}`).join(" · ")}
                    </div>
                  </TD>
                  <TD className="pr-5">
                    <div className="flex items-center gap-2">
                      <Avatar name={owner.name} size="sm" />
                      <span className="text-body">{owner.name.split(" ")[0]}</span>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {!list.length && <div className="py-12 text-center text-body text-muted-foreground">No agreements for this client.</div>}
      </Card>
    </div>
  );
}
