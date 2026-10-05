"use client";

import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  Clapperboard,
  ClipboardList,
  FileSignature,
  FileText,
  Filter,
  ReceiptIndianRupee,
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
  Inbox,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SetupStep } from "@gm/shared";
import { cn } from "@/lib/utils";
import { inr } from "./packages";
import { useNavVisible } from "./nav";
import {
  useAgreements,
  useCan,
  useClients,
  useFinanceMonths,
  useInvoices,
  useLeads,
  useMe,
  useOnboardingList,
  useProposals,
  useStages,
  useTeam,
  useVideos,
  useContentList,
  useJobOverview,
  useClientRequests,
  useSetup,
  useHideSetup,
} from "./queries";
import { GenieHomeCard } from "./genie";

interface Step {
  key: SetupStep;
  title: string;
  why: string;
  href: string;
  /** Another way to do it, e.g. a whole list from Excel. */
  also?: { label: string; href: string };
}

/** The guided set-up (P1-32): what a new agency sets up, where, and why — in the order that makes sense. */
const GROUPS: { title: string; steps: Step[] }[] = [
  {
    title: "Your agency",
    steps: [
      {
        key: "agency_questionnaire",
        title: "Your agency questionnaire",
        why: "About your own agency — stage, services and packages, main goal, team. It sets up your profile and packages, and drafts your goals.",
        href: "/app/onboarding/agency",
      },
      {
        key: "profile",
        title: "Agency profile and branding",
        why: "Your name, logo and colour for the client portal and documents, your contact details, and how long clients have to finish onboarding.",
        href: "/app/settings/agency",
      },
      {
        key: "packages",
        title: "Packages",
        why: "What you sell each month — price, deliverables, shoot days and revisions. Agreements and quotas come from these.",
        href: "/app/settings/packages",
      },
      {
        key: "roles",
        title: "Check roles and permissions",
        why: "Each role starts from the Growth OS defaults. Decide what each one may see, change and approve — salaries stay with the owner until you grant them.",
        href: "/app/settings/roles",
      },
      {
        key: "team",
        title: "Invite your team",
        why: "Send each person an invitation with their role. They see only what that role allows.",
        href: "/app/settings/team",
        also: { label: "or import your team from Excel", href: "/app/import?kind=team" },
      },
      {
        key: "invoices",
        title: "Invoice settings",
        why: "Your GSTIN and registered state, the services you invoice with their SAC codes, how invoices are numbered, and your bank details.",
        href: "/app/settings/invoices",
      },
    ],
  },
  {
    title: "Clients and sales",
    steps: [
      {
        key: "clients",
        title: "Add your clients",
        why: "Each client with the person who approves their work.",
        href: "/app/clients",
        also: { label: "or import your client list from Excel", href: "/app/import?kind=clients" },
      },
      {
        key: "leads",
        title: "Your sales pipeline",
        why: "Rename the stages to the way you sell, and add the people you are following up.",
        href: "/app/sales",
        also: { label: "or import your leads from Excel", href: "/app/import?kind=leads" },
      },
      {
        key: "onboarding_questions",
        title: "Check the onboarding questions",
        why: "The questions new clients answer, starting from Growth OS. Change, add or translate them before your first client gets the link.",
        href: "/app/settings/onboarding",
      },
    ],
  },
  {
    title: "Production",
    steps: [
      {
        key: "production",
        title: "Production settings",
        why: "How your video codes look, your formats and editing time, the edit steps, quality checks and kit lists — from the Growth OS defaults.",
        href: "/app/settings/production",
      },
      {
        key: "platforms",
        title: "Your clients' platforms",
        why: "Where each client's videos are published (Instagram, YouTube…), set on the client's page, so posts can be scheduled.",
        href: "/app/clients",
      },
      {
        key: "videos",
        title: "Videos already in progress",
        why: "Bring in the videos you are working on now from your tracking sheet, at the stage each one has reached.",
        href: "/app/import?kind=videos",
      },
    ],
  },
  {
    title: "Reaching clients",
    steps: [
      {
        key: "whatsapp",
        title: "WhatsApp Business",
        why: "Connect your own WhatsApp number so approvals, reminders and confirmations reach clients there.",
        href: "/app/settings/whatsapp",
      },
      {
        key: "portal",
        title: "Client portal",
        why: "Give each client contact their private link: they see their videos, approve them and pick topics, with your branding.",
        href: "/app/clients",
      },
    ],
  },
];
const ALL_STEPS = GROUPS.flatMap((g) => g.steps);

function SetupChecklist() {
  const can = useCan();
  const setup = useSetup();
  const hide = useHideSetup();
  const [expanded, setExpanded] = useState<boolean | null>(null);
  if (!setup.data || setup.data.hidden) return null;
  const done = ALL_STEPS.filter((s) => setup.data.steps[s.key]).length;
  // Open by itself while most of the set-up is still to do; folded to its progress once most of it is done.
  const open = expanded ?? done < ALL_STEPS.length / 2;
  return (
    <SectionCard
      title="Set up your workspace"
      description={`${done} of ${ALL_STEPS.length} done. Each step opens the right screen and ticks itself once it is done.`}
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!open)} aria-expanded={open}>
            {open ? "Hide steps" : "Show steps"}
            <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          </Button>
          {can("settings", "edit") &&
            (done === ALL_STEPS.length ? (
              <Button variant="ghost" size="sm" disabled={hide.isPending} onClick={() => hide.mutate(true)}>
                Hide
              </Button>
            ) : (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/setup">
                  Set-up wizard <ArrowRight />
                </Link>
              </Button>
            ))}
        </>
      }
    >
      <Progress value={(done / ALL_STEPS.length) * 100} tone="success" className={open ? "mb-5" : undefined} />
      {open && (
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-body font-semibold text-muted-foreground">{g.title}</h3>
              <ol className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border">
                {g.steps.map((s) => {
                  const ok = setup.data.steps[s.key];
                  return (
                    <li key={s.key} className="transition-colors hover:bg-surface-secondary">
                      <Link href={s.href} className="group flex items-start gap-3 px-4 py-3">
                        {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-5 shrink-0 text-text-muted" />}
                        <span className="min-w-0 flex-1">
                          <span className={ok ? "text-body font-medium text-muted-foreground line-through" : "text-body font-medium"}>{s.title}</span>
                          <span className="mt-0.5 block text-body text-muted-foreground">{s.why}</span>
                        </span>
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-text-muted group-hover:text-primary" />
                      </Link>
                      {s.also && !ok && (
                        <Link href={s.also.href} className="-mt-2 block pb-3 pl-12 text-body text-primary hover:underline">
                          {s.also.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

interface Attention {
  href: string;
  icon: LucideIcon;
  title: string;
  value: React.ReactNode;
  tone?: "danger" | "warning";
}

/** One list of what is waiting on this person, most pressing first; each opens the right screen. */
function NeedsAttention({ items }: { items: Attention[] }) {
  return (
    <SectionCard title="Needs your attention" contentClassName="px-2 pb-2">
      {items.length ? (
        <ul>
          {items.map((a) => (
            <li key={a.href + a.title}>
              <Link href={a.href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                <span
                  className={cn(
                    "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
                    a.tone === "danger" ? "bg-danger-soft text-danger" : a.tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary",
                  )}
                >
                  <a.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 text-body text-text-primary">{a.title}</span>
                <span className="shrink-0 text-body font-semibold tabular-nums text-text-primary">{a.value}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3 px-3 pb-2 text-body text-muted-foreground">
          <CircleCheck className="size-5 text-success" />
          Nothing is waiting on you.
        </div>
      )}
    </SectionCard>
  );
}

const monthShort = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

const CHART_SERIES = [
  { key: "Contracted", fill: "var(--color-chart-1)", dot: "bg-chart-1" },
  { key: "Invoiced", fill: "var(--color-chart-4)", dot: "bg-chart-4" },
  { key: "Collected", fill: "var(--color-chart-3)", dot: "bg-chart-3" },
] as const;

/** The last six months' money, from Finance: what was contracted, invoiced and collected. */
function MoneyChart() {
  const months = useFinanceMonths();
  const rows = [...(months.data ?? [])]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map((m) => ({ month: monthShort(m.month), Contracted: m.contracted, Invoiced: m.invoiced, Collected: m.collected }));
  if (!rows.length) return null;
  // Round steps (₹25K, ₹50K, ₹1L, ₹2L…) so the axis reads like money, not like a calculator.
  const max = Math.max(1, ...rows.flatMap((r) => [r.Contracted, r.Invoiced, r.Collected]));
  const step = [10_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000].find((s) => s * 4 >= max) ?? 10_000_000;
  const ticks = [0, step, step * 2, step * 3, step * 4];
  const axis = (v: number) => (v === 0 ? "₹0" : v >= 100_000 ? `₹${v / 100_000}L` : `₹${v / 1000}K`);
  return (
    <SectionCard
      title="Money, last six months"
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/finance">
            Finance <ArrowRight />
          </Link>
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap gap-4 text-body text-muted-foreground">
        {CHART_SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", s.dot)} />
            {s.key}
          </span>
        ))}
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 14 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              domain={[0, ticks[4]!]}
              ticks={ticks}
              tick={{ fill: "var(--color-text-muted)", fontSize: 14 }}
              tickFormatter={axis}
            />
            <Tooltip
              cursor={{ fill: "var(--color-muted)" }}
              formatter={(v) => inr(Number(v))}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
                boxShadow: "var(--shadow-md)",
                fontSize: 14,
              }}
              labelStyle={{ color: "var(--color-text-muted)", marginBottom: 4 }}
              itemStyle={{ color: "var(--color-text-primary)", padding: 0 }}
            />
            {CHART_SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.fill} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

const greeting = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
const tileCls = "h-full transition-colors hover:border-secondary/40";

export function LiveHome() {
  const me = useMe().data!;
  const can = useCan();
  const visible = useNavVisible();
  const [now] = useState(() => new Date());
  const team = useTeam(can("team", "view"));
  const clients = useClients(can("clients", "view"));
  const leads = useLeads(can("crm", "view"));
  const approvals = useProposals("pending_approval", can("crm", "approve"));
  const toSign = useAgreements("status=draft", can("agreements", "approve"));
  const toIssue = useInvoices("status=draft", can("invoices", "approve"));
  const overdue = useInvoices("overdue=1", can("invoices", "view"));
  const onboarding = useOnboardingList(can("onboarding", "view"));
  const videos = useVideos("", can("production", "view"));
  const scripts = useContentList("stage=script", can("content", "approve"));
  const renewals = useAgreements("renewal=1", can("agreements", "view"));
  const jobs = useJobOverview(can("settings", "edit"));
  const requests = useClientRequests("open", can("clients", "view"));
  const stages = useStages();
  const showMoney = visible({ title: "Finance", href: "/app/finance", icon: ReceiptIndianRupee, area: "finance", suite: "finance" });
  useFinanceMonths(showMoney);

  const vids = videos.data ?? [];
  const toQc = vids.filter((v) => v.stage === "internal_qc").length;
  const late = vids.filter((v) => v.overdue).length;
  const inProduction = vids.filter((v) => !["planned", "approved", "published"].includes(v.stage)).length;
  const toReview = (scripts.data ?? []).filter((c) => c.scripts[0]?.status === "review").length;
  const attention = (onboarding.data ?? []).filter((o) => o.remindersDue.length > 0 || o.window.state === "overdue").length;
  const open = new Set((stages.data ?? []).filter((s) => s.kind === "open").map((s) => s.key));
  const today = now.toISOString().slice(0, 10);
  const pipeline = (leads.data ?? []).filter((l) => open.has(l.stage));
  const due = pipeline.filter((l) => l.nextFollowUp && l.nextFollowUp <= today).length;
  const active = (clients.data ?? []).filter((c) => !c.archivedAt);
  const overdueTotal = (overdue.data ?? []).reduce((n, i) => n + i.total, 0);
  const agency = me.agencies.find((a) => a.id === me.activeAgencyId);
  const firstName = me.user.name.split(" ")[0];
  const canSetUp = can("team", "edit") || can("roles", "edit");
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  // The same things the old tiles showed, as one list: most pressing first, only what is waiting.
  const items: Attention[] = [];
  if (can("invoices", "view") && overdue.data?.length)
    items.push({ href: "/app/invoices?view=overdue", icon: ReceiptIndianRupee, title: `Invoices overdue (${overdue.data.length})`, value: inr(overdueTotal), tone: "danger" });
  if (can("production", "view") && late > 0) items.push({ href: "/app/production", icon: CalendarClock, title: "Videos past their due date", value: late, tone: "danger" });
  if (can("settings", "edit") && jobs.data?.failed)
    items.push({ href: "/app/settings/jobs", icon: TriangleAlert, title: "Background jobs that failed", value: jobs.data.failed, tone: "danger" });
  if (can("clients", "view") && requests.data?.length)
    items.push({ href: "/app/requests", icon: Inbox, title: "Client requests waiting for an answer", value: requests.data.length });
  if (can("crm", "approve") && approvals.data?.length)
    items.push({ href: "/app/sales", icon: BadgePercent, title: "Discounts waiting for your approval", value: approvals.data.length, tone: "warning" });
  if (can("production", "approve") && toQc > 0) items.push({ href: "/app/production?tab=qc", icon: ShieldCheck, title: "Videos waiting for the quality check", value: toQc });
  if (can("content", "approve") && toReview > 0) items.push({ href: "/app/content", icon: FileText, title: "Scripts to review", value: toReview });
  if (can("crm", "view") && due > 0) items.push({ href: "/app/sales", icon: CalendarClock, title: "Follow-ups due today", value: due, tone: "warning" });
  if (can("onboarding", "view") && attention > 0)
    items.push({ href: "/app/onboarding", icon: ClipboardList, title: "Onboarding: reminders due or overdue", value: attention, tone: "warning" });
  if (can("invoices", "approve") && toIssue.data?.length)
    items.push({ href: "/app/invoices?view=drafts", icon: FileText, title: "Draft invoices to issue", value: toIssue.data.length });
  if (can("agreements", "approve") && toSign.data?.length)
    items.push({ href: "/app/agreements?view=drafts", icon: FileSignature, title: "Agreements waiting for your sign-off", value: toSign.data.length });
  if (can("agreements", "view") && renewals.data?.length)
    items.push({ href: "/app/agreements?view=renewal", icon: RefreshCcw, title: "Agreements due for renewal", value: renewals.data.length });

  const tiles: React.ReactNode[] = [];
  if (can("clients", "view"))
    tiles.push(
      <Link key="clients" href="/app/clients" className="block">
        <StatCard
          label="Monthly fees"
          icon={Building2}
          value={clients.data ? inr(active.reduce((n, c) => n + c.monthlyFee, 0)) : "…"}
          hint={clients.data ? count(active.length, "active client", "active clients") : undefined}
          className={tileCls}
        />
      </Link>,
    );
  if (can("crm", "view"))
    tiles.push(
      <Link key="pipeline" href="/app/sales" className="block">
        <StatCard
          label="Open pipeline"
          icon={Filter}
          tone="info"
          value={leads.data ? inr(pipeline.reduce((n, l) => n + l.value, 0)) : "…"}
          hint={leads.data ? `${count(pipeline.length, "open lead", "open leads")}${due ? ` · ${due} to follow up today` : ""}` : undefined}
          className={tileCls}
        />
      </Link>,
    );
  if (can("production", "view"))
    tiles.push(
      <Link key="production" href="/app/production" className="block">
        <StatCard
          label="Videos in production"
          icon={Clapperboard}
          tone="gold"
          value={videos.data ? inProduction : "…"}
          hint={videos.data ? `${late ? `${late} past due` : "None late"} · ${toQc} waiting for QC` : undefined}
          className={tileCls}
        />
      </Link>,
    );
  if (can("invoices", "view"))
    tiles.push(
      <Link key="overdue" href="/app/invoices?view=overdue" className="block">
        <StatCard
          label="Overdue from clients"
          icon={ReceiptIndianRupee}
          tone={overdueTotal ? "danger" : "success"}
          value={overdue.data ? inr(overdueTotal) : "…"}
          hint={overdue.data ? (overdue.data.length ? count(overdue.data.length, "invoice past due", "invoices past due") : "Nothing overdue") : undefined}
          className={tileCls}
        />
      </Link>,
    );

  const shortcuts: { href: string; icon: LucideIcon; title: string; value?: React.ReactNode }[] = [];
  if (can("clients", "view")) shortcuts.push({ href: "/app/clients", icon: Building2, title: "Clients", value: clients.data ? active.length : "…" });
  if (can("team", "view")) {
    shortcuts.push({ href: "/app/settings/team", icon: Users, title: "People in the team", value: team.data?.members.length ?? "…" });
    shortcuts.push({ href: "/app/settings/roles", icon: ShieldCheck, title: "Roles and permissions" });
  }

  return (
    <>
      <PageHeader
        title={`${greeting(now.getHours())}, ${firstName}`}
        description={[now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }), agency?.name, me.role?.name]
          .filter(Boolean)
          .join(" · ")}
      />
      {tiles.length > 0 && <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles}</div>}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {showMoney && <MoneyChart />}
          <GenieHomeCard />
          {canSetUp && me.activeAgencyId ? (
            <SetupChecklist />
          ) : (
            <SectionCard title="Your workspace" description="What you can open depends on your role. Ask an owner if something you need is missing.">
              <p className="text-body text-muted-foreground">Use the menu on the left, or search with Ctrl K.</p>
            </SectionCard>
          )}
        </div>
        <div className="space-y-6">
          <NeedsAttention items={items} />
          {shortcuts.length > 0 && (
            <Card className="p-2">
              <div className="px-3 pb-1 pt-2 text-subheading font-semibold">Shortcuts</div>
              <ul>
                {shortcuts.map((x) => (
                  <li key={x.href}>
                    <Link href={x.href} className="group flex items-center gap-3 rounded-lg px-3 py-2 text-body transition-colors hover:bg-muted">
                      <x.icon className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="min-w-0 flex-1 text-text-primary">{x.title}</span>
                      {x.value !== undefined && <span className="tabular-nums text-muted-foreground">{x.value}</span>}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
