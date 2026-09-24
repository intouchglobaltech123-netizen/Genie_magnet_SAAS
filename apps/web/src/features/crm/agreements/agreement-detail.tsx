"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Ban, CheckCircle2, CircleDot, FileSignature, History, Mail, Phone, RefreshCw, ShieldCheck, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CategoryBadge, StageBadge, UrgencyIcon } from "@/components/shared/video-bits";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clientById, cycles, isOverdue, personById } from "@/lib/mock/core";
import { billingSchedule, originalTerms, type Invoice } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import { cn, fmtDate, inr, pct } from "@/lib/utils";
import { AgreementActions } from "./agreement-actions";
import { periodProgress, StatusBadge, unitsTotal, useAgreements, type LiveAgreement } from "./shared";

const d = (iso: string) => format(parseISO(iso), "d MMM yyyy");

export function AgreementDetail({ id }: { id: string }) {
  const a = useAgreements().find((x) => x.id === id);
  if (!a) {
    return (
      <div className="py-24 text-center">
        <div className="text-[15px] font-semibold">Agreement not found</div>
        <Button variant="link" asChild>
          <Link href="/agreements">Back to agreements</Link>
        </Button>
      </div>
    );
  }
  const c = clientById(a.clientId);
  return (
    <div>
      <Link href="/agreements" className="mb-3 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Agreements
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={c.category} /> <StatusBadge status={a.status} /> <span>{a.service}</span>
          </span>
        }
        title={c.name}
        description={`${a.packageName} · ${d(a.startDate)} → ${d(a.endDate)} · ${inr(a.monthlyFee)}/month`}
        actions={<AgreementActions a={a} clientName={c.name} />}
      />
      <Tabs defaultValue="overview">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-thin lg:mx-0 lg:px-0">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="cycles">Cycles</TabsTrigger>
            <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="changes">
              Changes{" "}
              <Badge tone="neutral" className="px-1.5 py-0">
                {a.changes.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <Overview a={a} />
        </TabsContent>
        <TabsContent value="cycles">
          <CyclesTab a={a} />
        </TabsContent>
        <TabsContent value="deliverables">
          <DeliverablesTab a={a} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab a={a} />
        </TabsContent>
        <TabsContent value="changes">
          <ChangesTab a={a} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Overview({ a }: { a: LiveAgreement }) {
  const c = clientById(a.clientId);
  const owner = personById(c.accountOwnerId);
  const orig = originalTerms[a.id] ?? { ...a.original, units: unitsTotal(a.original) };
  const changed = a.monthlyFee !== orig.monthlyFee || a.endDate !== orig.endDate || unitsTotal(a) !== orig.units;
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Scope per cycle</CardTitle>
              <CardDescription>{unitsTotal(a)} deliverables every month</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {a.units.map((u) => (
              <div key={u.label} className="rounded-xl border border-border p-4">
                <div className="text-[28px] font-semibold leading-none tabular">{u.perCycle}</div>
                <div className="mt-1.5 text-[12.5px] text-muted-foreground">{u.label}</div>
              </div>
            ))}
          </CardContent>
          <CardContent className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <Fact label="Revisions" value={`${a.revisionsPerDeliverable} per deliverable`} />
            <Fact label="Turnaround" value={`${a.turnaroundDays} working days`} />
            <Fact label="Billing" value={a.billing} />
            <Fact label="Monthly fee" value={inr(a.monthlyFee)} />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" /> Client responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {a.responsibilities.map((r) => (
                  <li key={r} className="flex gap-2">
                    <CircleDot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="size-4 text-danger" /> Exclusions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {a.exclusions.map((r) => (
                  <li key={r} className="flex gap-2">
                    <CircleDot className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /> {r}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-muted-foreground">Anything excluded is raised as an out-of-scope change request with a price.</p>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Term</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={periodProgress(a) * 100} />
            <div className="mt-2 flex justify-between text-[12px] text-muted-foreground tabular">
              <span>{d(a.startDate)}</span>
              <span>{d(a.endDate)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4">
              <Avatar name={owner.name} />
              <div>
                <div className="text-[13px] font-medium">{owner.name}</div>
                <div className="text-[12px] text-muted-foreground">Account owner</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Approvers & contacts</CardTitle>
              <CardDescription>Only approvers can sign off deliverables</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.contacts.map((p) => (
              <div key={p.email} className="flex items-start gap-2.5">
                <Avatar name={p.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[13px] font-medium">
                    {p.name}{" "}
                    {p.approver && (
                      <Badge tone="success">
                        <ShieldCheck /> Approver
                      </Badge>
                    )}
                  </div>
                  <div className="text-[12px] text-muted-foreground">{p.title}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="size-3" />
                      {p.phone}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      {p.email}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="size-4 text-muted-foreground" /> Original commitment
              </CardTitle>
              <CardDescription>As signed — kept for reference</CardDescription>
            </div>
            {changed && <Badge tone="warning">Amended</Badge>}
          </CardHeader>
          <CardContent className="space-y-1.5 text-[12.5px]">
            <Row k="Package" v={orig.packageName} />
            <Row k="Fee" v={`${inr(orig.monthlyFee)}/mo`} />
            <Row k="Term" v={`${d(orig.startDate)} – ${d(orig.endDate)}`} />
            <Row k="Units" v={`${orig.units} per cycle`} />
            <Button variant="link" size="xs" className="h-auto pt-1" onClick={() => toast("Signed PDF opened", { description: `${a.id.toUpperCase()}-signed.pdf · 6 pages` })}>
              View signed PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-medium">{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}

const cycleTone = { upcoming: "neutral", "in-progress": "accent", reconciling: "warning", closed: "success" } as const;

function CyclesTab({ a }: { a: LiveAgreement }) {
  const list = cycles.filter((c) => c.agreementId === a.id).sort((x, y) => y.start.localeCompare(x.start));
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Cycle</TH>
            <TH>Status</TH>
            <TH className="min-w-56">Promised vs delivered</TH>
            <TH className="text-right">Revenue</TH>
            <TH className="text-right">Cost</TH>
            <TH className="pr-5 text-right">Margin</TH>
          </TR>
        </THead>
        <TBody>
          {list.map((c) => {
            const margin = c.cost ? (c.revenue - c.cost) / c.revenue : null;
            return (
              <TR key={c.id}>
                <TD className="pl-5 font-medium">{c.label}</TD>
                <TD>
                  <Badge tone={cycleTone[c.status]} dot>
                    {c.status}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="bg-success" style={{ width: `${(c.delivered / c.promised) * 100}%` }} />
                      <div className="bg-accent/50" style={{ width: `${(c.inProgress / c.promised) * 100}%` }} />
                    </div>
                    <span className="w-24 text-[12px] tabular">
                      <b>{c.delivered}</b>/{c.promised} {c.inProgress > 0 && <span className="text-muted-foreground">· {c.inProgress} wip</span>}
                    </span>
                  </div>
                </TD>
                <TD className="text-right tabular">{inr(c.revenue)}</TD>
                <TD className="text-right tabular text-muted-foreground">{c.cost ? inr(c.cost) : "—"}</TD>
                <TD className={cn("pr-5 text-right font-semibold tabular", margin !== null && margin < 0.2 && "text-danger", margin !== null && margin >= 0.35 && "text-success")}>
                  {margin === null ? "—" : pct(margin)}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      {!list.length && <div className="py-10 text-center text-[13px] text-muted-foreground">No cycles yet.</div>}
    </Card>
  );
}

function DeliverablesTab({ a }: { a: LiveAgreement }) {
  const videos = useDemo((s) => s.videos).filter((v) => v.agreementId === a.id);
  return (
    <Card className="overflow-hidden">
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Code</TH>
            <TH>Title</TH>
            <TH>Format</TH>
            <TH>Stage</TH>
            <TH>Due</TH>
            <TH className="pr-5 text-right">Revisions</TH>
          </TR>
        </THead>
        <TBody>
          {videos.map((v) => (
            <TR key={v.id}>
              <TD className="pl-5">
                <div className="flex items-center gap-2">
                  <UrgencyIcon urgency={v.urgency} />
                  <span className="font-mono text-[12px]">{v.code}</span>
                </div>
              </TD>
              <TD>
                <Link href={`/production/${v.id}`} className="font-medium hover:text-accent">
                  {v.title}
                </Link>
              </TD>
              <TD className="text-muted-foreground">
                {v.format} · {v.aspect}
              </TD>
              <TD>
                <StageBadge stage={v.stage} />
              </TD>
              <TD className={cn("tabular", isOverdue(v) && "font-medium text-danger")}>{fmtDate(v.dueDate)}</TD>
              <TD className="pr-5 text-right tabular">
                {v.revisionsUsed}/{a.revisionsPerDeliverable}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {!videos.length && <div className="py-10 text-center text-[13px] text-muted-foreground">No deliverables in this cycle yet.</div>}
    </Card>
  );
}

const invTone: Record<Invoice["status"], "success" | "warning" | "danger" | "neutral" | "info"> = {
  paid: "success",
  partial: "warning",
  due: "info",
  overdue: "danger",
  scheduled: "neutral",
};

function BillingTab({ a }: { a: LiveAgreement }) {
  const invoices = billingSchedule(a);
  const paid = invoices.reduce((s, i) => s + i.paid, 0);
  const outstanding = invoices.filter((i) => i.status !== "scheduled").reduce((s, i) => s + i.amount - i.paid, 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Collected to date</div>
          <div className="mt-1 text-[20px] font-semibold tabular">{inr(paid)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Outstanding</div>
          <div className={cn("mt-1 text-[20px] font-semibold tabular", outstanding && "text-danger")}>{inr(outstanding)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] text-muted-foreground">Terms</div>
          <div className="mt-1 text-[15px] font-semibold">{a.billing}</div>
          <div className="text-[12px] text-muted-foreground">+ 18% GST</div>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Invoice</TH>
              <TH>Period</TH>
              <TH>Issued</TH>
              <TH>Due</TH>
              <TH className="text-right">Amount</TH>
              <TH className="text-right">Paid</TH>
              <TH className="pr-5">Status</TH>
            </TR>
          </THead>
          <TBody>
            {invoices.map((i) => (
              <TR key={i.no}>
                <TD className="pl-5 font-mono text-[12px]">{i.no}</TD>
                <TD>{i.period}</TD>
                <TD className="tabular text-muted-foreground">{fmtDate(i.issued)}</TD>
                <TD className="tabular text-muted-foreground">{fmtDate(i.due)}</TD>
                <TD className="text-right tabular">{inr(i.amount)}</TD>
                <TD className="text-right tabular">{i.paid ? inr(i.paid) : "—"}</TD>
                <TD className="pr-5">
                  <div className="flex items-center gap-2">
                    <Badge tone={invTone[i.status]} dot>
                      {i.status}
                    </Badge>
                    {i.status === "overdue" && (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="h-6"
                        onClick={() => toast.success(`Reminder sent for ${i.no}`, { description: "WhatsApp + email to accounts contact" })}
                      >
                        Remind
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

const changeIcon = { create: StickyNote, sign: FileSignature, change: History, renew: RefreshCw, note: StickyNote };

function ChangesTab({ a }: { a: LiveAgreement }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Change history</CardTitle>
          <CardDescription>Every amendment is logged with who approved it — original terms are never overwritten</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
          {a.changes.map((ch, i) => {
            const Icon = changeIcon[ch.kind];
            return (
              <li key={i} className="relative flex gap-3">
                <span
                  className={cn(
                    "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground",
                    ch.kind === "renew" && "border-success/40 bg-success-soft text-success",
                    ch.kind === "change" && "border-accent/40 bg-accent-soft text-accent",
                    ch.kind === "sign" && "border-info/40 bg-info-soft text-info",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <div className="pt-1">
                  <div className="text-[13px] font-medium">{ch.text}</div>
                  <div className="text-[12px] text-muted-foreground">
                    {d(ch.at)} · {ch.kind === "sign" ? "signed by" : ch.by === "System" ? "automated" : "approved by"} {ch.by !== "System" && ch.by}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
