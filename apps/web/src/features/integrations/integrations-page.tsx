"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Clock, CreditCard, FolderOpen, GraduationCap, Mail, MessageCircle, ScanFace, Webhook } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsAppPreview } from "@/components/shared/whatsapp-preview";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SectionCard } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clients } from "@/lib/mock/core";
import { fillTemplate, waTemplates } from "@/lib/mock/whatsapp";
import { cn } from "@/lib/utils";
import { ClientPlatforms, PlatformTile } from "./platform-bits";
import { PLATFORMS, useIntegrations } from "./platforms";

// Real approval status, not demo data: nothing has been submitted yet (see the external approvals plan).
const APPS = [
  { provider: "Meta (Instagram, Facebook)", status: "Start now", tone: "warning" as const, detail: "Business verification (Genie Magnet) then app review for publishing and insights · 2–6 weeks", phase: "Needed for Phase 3" },
  { provider: "Google (YouTube, Drive, Calendar)", status: "Phase 1", tone: "info" as const, detail: "Google Cloud project and OAuth verification · YouTube audit for public uploads", phase: "Needed for Phase 3" },
  { provider: "LinkedIn", status: "Phase 1", tone: "info" as const, detail: "Community Management API application · several weeks", phase: "Needed for Phase 5" },
  { provider: "X (Twitter)", status: "Phase 4", tone: "neutral" as const, detail: "Paid API tier", phase: "Needed for Phase 5" },
];

const OTHER = [
  { icon: FolderOpen, name: "Google Drive", desc: "Footage and deliverable links on every video", status: "Phase 1" },
  { icon: CalendarDays, name: "Google Calendar", desc: "Shoots, reviews and leave on everyone's calendar", status: "Phase 3" },
  { icon: CreditCard, name: "Razorpay", desc: "Payment links on invoices; paid status comes back automatically", status: "Phase 3" },
  { icon: Mail, name: "Email sending", desc: "Invoices, reports and alerts from geniemagnet.in", status: "Phase 1" },
  { icon: ScanFace, name: "Hikvision attendance", desc: "Import punches from the biometric device or Excel", status: "Phase 5" },
  { icon: GraduationCap, name: "Genie Magnet LMS", desc: "Training links and completion into Learning", status: "Phase 5" },
  { icon: Webhook, name: "Webhooks & API", desc: "Send events to any tool (for SaaS agencies)", status: "Phase 7" },
];

const MESSAGES = [
  { at: "25 Sep · 10:42", to: "Dr. Arvind Balaji", template: "approval_reminder", status: "Delivered", reply: "" },
  { at: "25 Sep · 09:15", to: "Ramesh Gounder", template: "approval_request", status: "Read", reply: "" },
  { at: "24 Sep · 18:02", to: "Nirmala Devi", template: "onboarding_reminder", status: "Read", reply: "" },
  { at: "24 Sep · 11:20", to: "Meenakshi Sundaram", template: "approval_request", status: "Replied", reply: "Approve" },
  { at: "23 Sep · 16:05", to: "Vikram Shetty", template: "invoice_reminder", status: "Delivered", reply: "" },
  { at: "22 Sep · 12:30", to: "Ramesh Gounder", template: "approval_confirmation", status: "Read", reply: "" },
];

export function IntegrationsPage() {
  const connections = useIntegrations((s) => s.connections);
  const attention = connections.filter((c) => c.status !== "connected").length;
  return (
    <div>
      <PageHeader
        eyebrow="Platform · Module 46"
        depth="demo"
        title="Integrations"
        description="Social platforms, WhatsApp Business and the tools Genie Magnet already uses. Each client connects their own accounts; the agency connects its apps once."
      />
      <Tabs defaultValue="social">
        <TabsList>
          <TabsTrigger value="social">Social platforms{attention ? ` · ${attention} need attention` : ""}</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Business</TabsTrigger>
          <TabsTrigger value="other">Other tools</TabsTrigger>
        </TabsList>
        <TabsContent value="social" className="space-y-4">
          <SectionCard title="Platform apps (agency level)" description="Approved once for Genie Magnet; every client account then connects through them. These approvals take weeks, so they start early.">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {APPS.map((a) => (
                <div key={a.provider} className="rounded-xl border border-border p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-body font-semibold">{a.provider}</span>
                    <Badge tone={a.tone}>{a.status}</Badge>
                  </div>
                  <div className="mt-1 text-body text-muted-foreground">{a.detail}</div>
                  <div className="mt-2 text-body text-muted-foreground">
                    <Clock className="mr-1 inline size-3.5" /> {a.phase}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Supported platforms" description="Add any of these to a client. New ones plug into the same connector — nothing else changes.">
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 rounded-xl border border-border px-2.5 py-1.5 text-body">
                  <PlatformTile p={p} size="sm" /> {p.name}
                  <span className="text-muted-foreground">· {p.phase}</span>
                </span>
              ))}
            </div>
          </SectionCard>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {clients.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <div>
                    <CardTitle>{c.name}</CardTitle>
                    <CardDescription>Client accounts</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ClientPlatforms clientId={c.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="whatsapp">
          <WhatsAppTab />
        </TabsContent>
        <TabsContent value="other">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {OTHER.map((o) => (
              <Card key={o.name} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <o.icon className="size-4" />
                  </span>
                  <Badge tone="neutral">{o.status}</Badge>
                </div>
                <div className="mt-3 text-body font-semibold">{o.name}</div>
                <div className="mt-0.5 text-body text-muted-foreground">{o.desc}</div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WhatsAppTab() {
  const [sel, setSel] = useState(waTemplates[0]!.id);
  const t = waTemplates.find((x) => x.id === sel)!;
  const sample = { name: "Ramesh", open: 3, due: "26 Sep", item: "script", title: "Palm sugar filter coffee — a healthy swap", days: 2, publish: "Sat 27 Sep", platforms: "Instagram and YouTube", invoice: "GM/26-27/061", amount: "₹85,000" };
  return (
    <div className="space-y-4">
      <Alert tone="info" icon={MessageCircle} title="One WhatsApp Business number for the agency">
        Messages use Meta-approved templates. Clients can approve with a button; their replies land on the right video or script. Internal reminders to the team go through the same number.
      </Alert>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-body text-muted-foreground">Business number</div>
          <div className="mt-1 text-subheading font-semibold">+91 98400 11000</div>
          <div className="text-body text-muted-foreground">Demo number · the real number and display name are set up with Genie Magnet before Phase 3</div>
        </Card>
        <Card className="p-4">
          <div className="text-body text-muted-foreground">Messages this week</div>
          <div className="mt-1 text-subheading font-semibold tabular">46 sent · 31 read</div>
          <div className="text-body text-muted-foreground">9 approvals came back by button</div>
        </Card>
        <Card className="p-4">
          <div className="text-body text-muted-foreground">Client groups linked</div>
          <div className="mt-1 text-subheading font-semibold tabular">
            4 of {clients.length}
          </div>
          <div className="text-body text-muted-foreground">Group link saved on each client from onboarding</div>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        <SectionCard title="Message templates" description="Approved by Meta before first use. Click one to preview it with sample values.">
          <ul className="divide-y divide-border-subtle rounded-xl border border-border">
            {waTemplates.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => setSel(x.id)}
                  aria-pressed={sel === x.id}
                  className={cn(
                    "flex w-full cursor-pointer flex-wrap items-center gap-3 px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                    sel === x.id ? "bg-primary-soft/50" : "hover:bg-muted/60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium">{x.purpose}</div>
                    <div className="font-mono text-body text-muted-foreground">{x.name}</div>
                  </div>
                  <Badge tone="outline">{x.category}</Badge>
                  <StatusBadge status={x.status} tone={x.status === "Approved" ? "success" : x.status === "In review" ? "warning" : "neutral"} />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
        <div className="space-y-2 xl:sticky xl:top-20 xl:self-start">
          <div className="text-body font-semibold">Preview · {t.purpose}</div>
          <WhatsAppPreview messages={[{ text: fillTemplate(t.body, sample), time: "10:42 AM", buttons: t.buttons }]} />
        </div>
      </div>
      <SectionCard title="Recent messages" description="Every message is logged against the client and the record it was about.">
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>To</TH>
              <TH>Template</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {MESSAGES.map((m) => (
              <TR key={m.at + m.to}>
                <TD className="whitespace-nowrap">{m.at}</TD>
                <TD>{m.to}</TD>
                <TD className="font-mono">{m.template}</TD>
                <TD>
                  {m.status === "Replied" ? (
                    <Badge tone="success">
                      <CheckCircle2 /> Replied “{m.reply}”
                    </Badge>
                  ) : (
                    <StatusBadge status={m.status} tone={m.status === "Read" ? "info" : "neutral"} />
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </SectionCard>
    </div>
  );
}

