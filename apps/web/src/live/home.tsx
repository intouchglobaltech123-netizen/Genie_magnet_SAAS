"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Building2,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileSignature,
  FileText,
  ReceiptIndianRupee,
  RefreshCcw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, SectionCard } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { inr } from "./packages";
import {
  useAgency,
  useAgencyOnboarding,
  useAgreements,
  useAudit,
  useCan,
  useClients,
  useInvoices,
  useInvoiceSettings,
  useLeads,
  useMe,
  useOnboardingList,
  usePackages,
  useProposals,
  useStages,
  useTeam,
  useVideos,
  useContentList,
} from "./queries";

interface Step {
  title: string;
  why: string;
  href?: string;
  done?: boolean;
}

/**
 * The guided set-up (P1-32): what a new agency sets up, where, and why. Steps tick themselves from real data.
 * Steps for screens not built yet are listed as coming next, so the owner sees the whole path.
 */
function SetupChecklist({ agencyId }: { agencyId: string }) {
  const can = useCan();
  const team = useTeam(can("team", "view"));
  const clients = useClients(can("clients", "view"));
  const roleChanges = useAudit("entity=role&limit=1", can("audit", "view"));
  const agency = useAgency();
  const packages = usePackages();
  const invoiceSettings = useInvoiceSettings(can("invoices", "view"));
  const agencyOnboarding = useAgencyOnboarding(can("onboarding", "view"));
  const storageKey = `gm-live-setup-hidden:${agencyId}`;
  // Rendered only in the browser (the shell waits for the session), so reading storage here is safe.
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const steps: Step[] = [
    {
      title: "Your agency questionnaire",
      why: "About your own agency — stage, services and packages, main goal, team. It sets up your profile and packages, and drafts your goals.",
      href: "/app/onboarding/agency",
      done: !!agencyOnboarding.data?.progress.required.complete,
    },
    {
      title: "Agency profile and branding",
      why: "Your name, logo and colour for the client portal and documents, your contact details, and how long clients have to finish onboarding.",
      href: "/app/settings/agency",
      done: !!(agency.data?.logo || agency.data?.brandColor || agency.data?.businessStage),
    },
    {
      title: "Packages",
      why: "What you sell each month — price, deliverables, shoot days and revisions. Agreements and quotas come from these.",
      href: "/app/settings/packages",
      done: (packages.data?.length ?? 0) > 0,
    },
    {
      title: "Check roles and permissions",
      why: "Each role starts from the Growth OS defaults. Decide what each one may see, change and approve — salaries stay with the owner until you grant them.",
      href: "/app/settings/roles",
      done: (roleChanges.data?.items.length ?? 0) > 0,
    },
    {
      title: "Invite your team",
      why: "Send each person an invitation with their role. They see only what that role allows.",
      href: "/app/settings/team",
      done: (team.data?.members.length ?? 0) > 1,
    },
    {
      title: "Add your clients",
      why: "Add each client with the person who approves their work — one by one, or your whole list from Excel.",
      href: "/app/clients",
      done: (clients.data?.length ?? 0) > 0,
    },
    {
      title: "Invoice settings",
      why: "Your GSTIN and registered state, the services you invoice with their SAC codes, how invoices are numbered, and your bank details.",
      href: "/app/settings/invoices",
      done: !!invoiceSettings.data,
    },
  ];
  const coming: Step[] = [];
  const done = steps.filter((s) => s.done).length;

  if (hidden) return null;
  return (
    <SectionCard
      title="Set up your workspace"
      description={`${done} of ${steps.length} done. Each step opens the right screen; it ticks itself once it is done.`}
      actions={
        done === steps.length && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setHidden(true);
              try {
                localStorage.setItem(storageKey, "1");
              } catch {}
            }}
          >
            Hide
          </Button>
        )
      }
    >
      <Progress value={(done / steps.length) * 100} tone="success" className="mb-4" />
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.title}>
            <Link
              href={s.href!}
              className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:border-secondary/40 hover:bg-secondary-soft"
            >
              {s.done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-5 shrink-0 text-text-muted" />}
              <span className="min-w-0 flex-1">
                <span className={s.done ? "text-body font-medium text-muted-foreground line-through" : "text-body font-medium"}>{s.title}</span>
                <span className="mt-0.5 block text-body text-muted-foreground">{s.why}</span>
              </span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-text-muted group-hover:text-primary" />
            </Link>
          </li>
        ))}
        {coming.map((s) => (
          <li key={s.title} className="flex items-start gap-3 rounded-lg border border-dashed border-border p-3 opacity-70">
            <Circle className="mt-0.5 size-5 shrink-0 text-text-muted" />
            <span className="min-w-0 flex-1">
              <span className="text-body font-medium">{s.title}</span> <Badge tone="neutral">Coming next</Badge>
              <span className="mt-0.5 block text-body text-muted-foreground">{s.why}</span>
            </span>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

function Shortcut({ href, icon: Icon, title, value }: { href: string; icon: typeof Users; title: string; value: React.ReactNode }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-secondary/40">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-body text-muted-foreground">{title}</span>
            <span className="block text-subheading font-semibold">{value}</span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export function LiveHome() {
  const me = useMe().data!;
  const can = useCan();
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
  const toQc = (videos.data ?? []).filter((v) => v.stage === "internal_qc").length;
  const late = (videos.data ?? []).filter((v) => v.overdue).length;
  const toReview = (scripts.data ?? []).filter((c) => c.scripts[0]?.status === "review").length;
  const attention = (onboarding.data ?? []).filter((o) => o.remindersDue.length > 0 || o.window.state === "overdue").length;
  const renewals = useAgreements("renewal=1", can("agreements", "view"));
  const stages = useStages();
  const open = new Set((stages.data ?? []).filter((s) => s.kind === "open").map((s) => s.key));
  const today = new Date().toISOString().slice(0, 10);
  const due = (leads.data ?? []).filter((l) => open.has(l.stage) && l.nextFollowUp && l.nextFollowUp <= today).length;
  const agency = me.agencies.find((a) => a.id === me.activeAgencyId);
  const firstName = me.user.name.split(" ")[0];
  const canSetUp = can("team", "edit") || can("roles", "edit");

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description={`${agency?.name ?? ""} · you are signed in as ${me.role?.name ?? "a member"}.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {canSetUp && me.activeAgencyId ? (
            <SetupChecklist agencyId={me.activeAgencyId} />
          ) : (
            <SectionCard title="Your workspace" description="What you can open depends on your role. Ask an owner if something you need is missing.">
              <p className="text-body text-muted-foreground">Use the menu on the left.</p>
            </SectionCard>
          )}
        </div>
        <div className="space-y-3">
          {can("crm", "approve") && !!approvals.data?.length && (
            <Shortcut href="/app/sales" icon={BadgePercent} title="Discounts waiting for your approval" value={approvals.data.length} />
          )}
          {can("production", "approve") && toQc > 0 && (
            <Shortcut href="/app/production?tab=qc" icon={ShieldCheck} title="Videos waiting for the quality check" value={toQc} />
          )}
          {can("content", "approve") && toReview > 0 && <Shortcut href="/app/content" icon={FileText} title="Scripts to review" value={toReview} />}
          {can("production", "view") && late > 0 && <Shortcut href="/app/production" icon={CalendarClock} title="Videos past their due date" value={late} />}
          {can("onboarding", "view") && attention > 0 && (
            <Shortcut href="/app/onboarding" icon={ClipboardList} title="Onboarding: reminders due or overdue" value={attention} />
          )}
          {can("invoices", "view") && !!overdue.data?.length && (
            <Shortcut
              href="/app/invoices?view=overdue"
              icon={ReceiptIndianRupee}
              title={`Invoices overdue (${overdue.data.length})`}
              value={inr(overdue.data.reduce((n, i) => n + i.total, 0))}
            />
          )}
          {can("invoices", "approve") && !!toIssue.data?.length && (
            <Shortcut href="/app/invoices?view=drafts" icon={FileText} title="Draft invoices to issue" value={toIssue.data.length} />
          )}
          {can("agreements", "approve") && !!toSign.data?.length && (
            <Shortcut href="/app/agreements?view=drafts" icon={FileSignature} title="Agreements waiting for your sign-off" value={toSign.data.length} />
          )}
          {can("agreements", "view") && !!renewals.data?.length && (
            <Shortcut href="/app/agreements?view=renewal" icon={RefreshCcw} title="Agreements due for renewal" value={renewals.data.length} />
          )}
          {can("crm", "view") && <Shortcut href="/app/sales" icon={CalendarClock} title="Follow-ups due today" value={leads.data ? due : "…"} />}
          {can("clients", "view") && (
            <Shortcut href="/app/clients" icon={Building2} title="Clients" value={clients.data ? clients.data.filter((c) => !c.archivedAt).length : "…"} />
          )}
          {can("team", "view") && <Shortcut href="/app/settings/team" icon={Users} title="People in the team" value={team.data?.members.length ?? "…"} />}
          {can("team", "view") && <Shortcut href="/app/settings/roles" icon={ShieldCheck} title="Roles and permissions" value="Open" />}
        </div>
      </div>
    </>
  );
}
