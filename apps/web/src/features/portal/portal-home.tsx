"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, CheckCircle2, ExternalLink, FileText, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { useDemo } from "@/lib/store";
import { agreementById, cycles, daysBetween, TODAY } from "@/lib/mock/core";
import { PORTAL_ACCOUNT_MANAGER, PORTAL_CLIENT_ID, PORTAL_USER, portalInvoices, publishTimes } from "@/lib/mock/portal";
import type { Video } from "@/lib/types";
import { cn, fmtDate, inr } from "@/lib/utils";
import { allowanceFor, firstName, latestVersion, portalVideos } from "./lib";
import { PortalEstimates } from "./portal-estimates";
import { Poster } from "./poster";
import { RequestDialog } from "./request-dialog";

const DELIVERED = new Set(["Approved", "Published"]);
const WITH_CLIENT = new Set(["Client Review"]);

function clientStatus(v: Video): { label: string; tone: "success" | "warning" | "accent" | "neutral" | "info" } {
  if (v.stage === "Published") return { label: "Published", tone: "success" };
  if (v.stage === "Approved") return { label: "Approved · scheduled", tone: "success" };
  if (v.stage === "Client Review") return { label: "Awaiting your review", tone: "warning" };
  if (v.stage === "Revision") return { label: "Updating per your notes", tone: "info" };
  if (["Planned", "Scripting", "Shoot Scheduled"].includes(v.stage)) return { label: "Planning & shoot", tone: "neutral" };
  return { label: "In production", tone: "info" };
}

export function PortalHome() {
  const videos = useDemo((s) => s.videos);
  const [requestOpen, setRequestOpen] = useState(false);

  const mine = useMemo(() => portalVideos(videos), [videos]);
  const cycle = cycles.find((c) => c.clientId === PORTAL_CLIENT_ID && c.label === "Sep 2026")!;
  const agreement = agreementById(cycle.agreementId);
  const sepVideos = mine.filter((v) => v.cycleId === cycle.id);
  const awaiting = mine.filter((v) => WITH_CLIENT.has(v.stage));
  const delivered = sepVideos.filter((v) => DELIVERED.has(v.stage)).length;
  const inProgress = sepVideos.length - delivered;
  const notStarted = Math.max(0, cycle.promised - sepVideos.length);

  const units = agreement.units.map((u) => {
    const match = (v: Video) =>
      u.label.startsWith("Reel") ? v.format === "Reel" || v.format === "Testimonial" : u.label.startsWith("Long") ? v.format === "Long-form" : v.format === "Ad";
    const vs = sepVideos.filter(match);
    return { ...u, delivered: vs.filter((v) => DELIVERED.has(v.stage)).length, active: vs.filter((v) => !DELIVERED.has(v.stage)).length };
  });

  const calendar = [...mine]
    .filter((v) => daysBetween(TODAY, v.publishDate) >= -3)
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate));

  const withRevisions = mine.filter((v) => v.versions.length > 0 && v.stage !== "Published");
  const approvals = mine.filter((v) => DELIVERED.has(v.stage));
  const oct = portalInvoices.find((i) => i.period === "Oct 2026")!;
  const sep = portalInvoices.find((i) => i.period === "Sep 2026")!;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-body font-medium text-muted-foreground">
            {fmtDate(TODAY, { weekday: "long", day: "numeric", month: "long" })} · {agreement.packageName}
          </p>
          <h1 className="mt-1.5 text-heading font-semibold tracking-tight">Good morning, {firstName(PORTAL_USER.name)}</h1>
          <p className="mt-1.5 max-w-xl text-body text-muted-foreground">
            {awaiting.length > 0 ? (
              <>
                <span className="font-medium text-text-primary">
                  {awaiting.length} video{awaiting.length > 1 ? "s" : ""} need{awaiting.length > 1 ? "" : "s"} your review
                </span>{" "}
                · {delivered} of {cycle.promised} September deliverables approved so far.
              </>
            ) : (
              <>You&apos;re all caught up. {delivered} of {cycle.promised} September deliverables are approved.</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/portal/library">Browse library</Link>
          </Button>
          <Button variant="default" onClick={() => setRequestOpen(true)}>
            <Plus /> Request something new
          </Button>
        </div>
      </section>

      {/* Awaiting review */}
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-subheading font-semibold tracking-tight">Awaiting your review</h2>
          <span className="text-body text-muted-foreground">Only you can approve · approval is never assumed from silence</span>
        </div>
        {awaiting.length === 0 ? (
          <EmptyState compact icon={CheckCircle2} title="Nothing waiting on you" description="We'll notify you on WhatsApp and email when the next cut is ready." />
        ) : (
          <div className={cn("grid grid-cols-1 gap-4", awaiting.length > 1 && "md:grid-cols-2")}>
            {awaiting.map((v, i) => {
              const ver = latestVersion(v);
              const overdueBy = daysBetween(v.dueDate, TODAY);
              return (
                <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link href={`/portal/review/${v.id}`} className={cn("group block rounded-2xl", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35")}>
                    <Card className={cn("overflow-hidden transition-colors group-hover:border-primary/40", awaiting.length === 1 && "md:grid md:grid-cols-[1.35fr_1fr]")}>
                      <Poster video={v} className={cn("aspect-[16/8]", awaiting.length === 1 && "md:aspect-auto md:min-h-[260px]")} size="lg" />
                      <div className={cn("flex items-start justify-between gap-3 p-5", awaiting.length === 1 && "md:flex-col md:justify-center md:p-7")}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 text-body text-muted-foreground">
                            <span className="font-mono">{v.code}</span>·<span>{v.format}</span>·<span>{ver?.duration}</span>
                          </div>
                          <div className="mt-1 truncate text-subheading font-semibold tracking-tight">{v.title}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge tone="info">{ver?.label} ready</Badge>
                            <Badge tone={overdueBy > 0 ? "warning" : "neutral"}>
                              <CalendarClock /> {overdueBy > 0 ? `Review requested by ${fmtDate(v.dueDate)}` : `Please review by ${fmtDate(v.dueDate)}`}
                            </Badge>
                            <Badge tone="outline">
                              Revisions {v.revisionsUsed} of {allowanceFor(v)}
                            </Badge>
                          </div>
                        </div>
                        <span className="mt-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary px-4 text-body font-medium text-primary-foreground shadow-sm transition-colors group-hover:bg-secondary">
                          Review <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <PortalEstimates />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Package progress */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-wrap">
            <div>
              <CardTitle>September package progress</CardTitle>
              <CardDescription>
                {agreement.packageName} · {cycle.promised} deliverables · 1–30 Sep 2026
              </CardDescription>
            </div>
            <Badge tone="success">{Math.round((delivered / cycle.promised) * 100)}% approved</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-success"
                  initial={{ width: 0 }}
                  animate={{ width: `${(delivered / cycle.promised) * 100}%` }}
                  transition={{ duration: 0.6 }}
                />
                <motion.div
                  className="h-full bg-primary/70"
                  initial={{ width: 0 }}
                  animate={{ width: `${(inProgress / cycle.promised) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                />
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-body">
                <Legend cls="bg-success" label="Approved / published" value={delivered} />
                <Legend cls="bg-primary/70" label="In progress" value={inProgress} />
                <Legend cls="bg-muted border border-border" label="Being planned" value={notStarted} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {units.map((u) => (
                <div key={u.label} className="rounded-xl border border-border p-3.5">
                  <div className="text-body text-muted-foreground">{u.label}</div>
                  <div className="mt-1 text-heading font-semibold tabular">
                    {u.delivered}
                    <span className="text-body font-normal text-muted-foreground"> / {u.perCycle}</span>
                  </div>
                  <Progress value={(u.delivered / u.perCycle) * 100} tone="success" className="mt-2" />
                  <div className="mt-1.5 text-body text-muted-foreground">{u.active} in progress</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Monthly advance · {inr(agreement.monthlyFee)} / month</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InvoiceRow
              title="October 2026"
              no={oct.no}
              amount={oct.amount}
              badge={<Badge tone="warning">Due {fmtDate(oct.dueOn)}</Badge>}
              onOpen={() => toast("Invoice opened", { description: `${oct.no} · ${inr(oct.amount)} due ${fmtDate(oct.dueOn, { day: "numeric", month: "long" })}` })}
            />
            <InvoiceRow
              title="September 2026"
              no={sep.no}
              amount={sep.amount}
              badge={<Badge tone="success">Paid {fmtDate(sep.paidOn!)}</Badge>}
              onOpen={() => toast("Receipt opened", { description: `${sep.no} · paid on ${fmtDate(sep.paidOn!, { day: "numeric", month: "long" })}` })}
            />
            <p className="pt-1 text-body text-muted-foreground">Invoices are issued on the 25th and due on the 1st of each month.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Content calendar</CardTitle>
              <CardDescription>What goes live next — posts only publish after your approval</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {calendar.length === 0 && (
              <div className="border-t border-border p-5">
                <EmptyState compact icon={CalendarClock} title="Nothing scheduled yet" description="Upcoming posts appear here once your videos are planned." />
              </div>
            )}
            <ul className="divide-y divide-border border-t border-border">
              {calendar.map((v) => {
                const st = clientStatus(v);
                const d = new Date(v.publishDate);
                const statusEl =
                  v.stage === "Client Review" ? (
                    <Button size="xs" variant="soft" asChild>
                      <Link href={`/portal/review/${v.id}`}>Review</Link>
                    </Button>
                  ) : (
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                  );
                return (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5">
                    <div className="w-11 shrink-0 text-center">
                      <div className="text-body font-medium uppercase text-muted-foreground">{d.toLocaleDateString("en-IN", { month: "short" })}</div>
                      <div className="text-subheading font-semibold leading-none tabular">{d.getDate()}</div>
                    </div>
                    <Poster video={v} className="hidden h-10 w-16 shrink-0 rounded-md sm:block" size="sm" showMeta={false} showPlay={false} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body font-medium">{v.title}</div>
                      <div className="truncate text-body text-muted-foreground">
                        {v.platform.join(" · ")} · {publishTimes[v.id] ?? "18:30"}
                      </div>
                      <div className="mt-1.5 sm:hidden">{statusEl}</div>
                    </div>
                    <div className="hidden shrink-0 sm:block">{statusEl}</div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Revision allowance */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Revision allowance</CardTitle>
              <CardDescription>{agreement.revisionsPerDeliverable} rounds included per video</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {withRevisions.length === 0 && <EmptyState compact icon={ShieldCheck} title="No videos in review yet" description="Your revision rounds show here once a first cut is shared." />}
            {withRevisions.map((v) => {
              const allow = allowanceFor(v);
              const left = Math.max(0, allow - v.revisionsUsed);
              return (
                <div key={v.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-body font-medium">{v.title}</span>
                    <span className={cn("shrink-0 text-body tabular", left === 0 ? "text-warning" : "text-muted-foreground")}>
                      {left} left
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: allow }).map((_, i) => (
                      <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < v.revisionsUsed ? "bg-primary" : "bg-muted")} />
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 rounded-lg bg-surface-secondary p-2.5 text-body text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
              Fixes for our own mistakes never count against your allowance.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-wrap">
            <div>
              <CardTitle>Recent approvals</CardTitle>
              <CardDescription>Every approval is recorded with the exact version you signed off</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portal/library">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {approvals.slice(0, 3).map((v) => {
              const ver = v.versions.find((x) => x.status === "approved") ?? latestVersion(v);
              return (
                <div key={v.id} className="group overflow-hidden rounded-xl border border-border">
                  <Poster video={v} className="aspect-video" size="sm" showMeta={false} />
                  <div className="p-3">
                    <div className="line-clamp-2 text-body font-medium leading-snug">{v.title}</div>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-body text-muted-foreground">
                      <span>
                        {ver?.label} approved
                      </span>
                      {v.publishedUrl ? (
                        <a href={v.publishedUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
                          Live <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span>Goes live {fmtDate(v.publishDate)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {approvals.length === 0 && <EmptyState compact icon={CheckCircle2} title="No approvals yet this month" description="Approved videos land here with the exact version you signed off." className="sm:col-span-3" />}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <div>
              <CardTitle>Your team</CardTitle>
              <CardDescription>One point of contact for everything</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={PORTAL_ACCOUNT_MANAGER.name} size="lg" />
              <div>
                <div className="font-medium">{PORTAL_ACCOUNT_MANAGER.name}</div>
                <div className="text-body text-muted-foreground">
                  {PORTAL_ACCOUNT_MANAGER.title} · {PORTAL_ACCOUNT_MANAGER.hours}
                </div>
              </div>
            </div>
            <div className="mt-auto rounded-xl border border-dashed border-border p-4">
              <div className="flex items-center gap-2 text-body font-medium">
                <Sparkles className="size-4 text-primary" /> Need something extra?
              </div>
              <p className="mt-1 text-body text-muted-foreground">Festive ads, extra cut-downs, new formats — you&apos;ll get an estimate first.</p>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setRequestOpen(true)}>
                <Plus /> Request something new
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <RequestDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}

function Legend({ cls, label, value }: { cls: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", cls)} />
      {label} <span className="font-medium text-text-primary tabular">{value}</span>
    </span>
  );
}

function InvoiceRow({ title, no, amount, badge, onOpen }: { title: string; no: string; amount: number; badge: React.ReactNode; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-body font-medium">{title}</div>
        <div className="truncate font-mono text-body text-muted-foreground">{no}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-body font-semibold tabular">{inr(amount)}</div>
        <div className="mt-0.5">{badge}</div>
      </div>
    </button>
  );
}
