"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Bell, Check, ClipboardList, ExternalLink, Lock, LockOpen, PhoneCall, Send, ShieldAlert, ShieldQuestion, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppSendDialog } from "@/components/shared/whatsapp-send-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { onboardingClients, onboardingTemplate } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import { cn, inr } from "@/lib/utils";
import { useCrmDemo } from "@/features/crm/crm-store";
import { fmtDay, isAnswered, REMINDER_DAYS, type SectionProgress } from "./engine";
import { BusinessCanvas, ContentPillars, ProductMatrix } from "./outputs";
import { useOnboarding, useRespondent } from "./store";
import { clientTemplate } from "./templates";

/** Checklist items that tick themselves once the matching answer arrives. */
const AUTO: Record<string, { q?: string; section?: string; from: string }> = {
  "ob-contacts": { q: "c2", from: "owners and contacts" },
  "ob-brand": { q: "c29", from: "brand files" },
  "ob-social": { q: "c31", from: "account access" },
  "ob-brief": { section: "goals", from: "engagement goals" },
  "ob-approver": { q: "c32", from: "approvers" },
  "ob-billing": { q: "c33", from: "billing details" },
};

const qById = Object.fromEntries(clientTemplate.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));

function useClientState(id: string) {
  const c = onboardingClients.find((x) => x.id === id)!;
  const live = useRespondent(id)!;
  const manual = useCrmDemo((s) => s.onboarding[id]) ?? c.initialDone;
  const exception = useCrmDemo((s) => s.exceptions[id]);
  const sections = live.prog.all;
  const auto = (itemId: string) => {
    const rule = AUTO[itemId];
    if (!rule) return false;
    if (rule.q) return isAnswered(qById[rule.q]!, live.r.answers[rule.q]);
    return sections.find((p) => p.section.id === rule.section)?.complete ?? false;
  };
  const isDone = (itemId: string) => manual.includes(itemId) || auto(itemId);
  const missingItems = onboardingTemplate.filter((i) => i.mandatory && !isDone(i.id));
  const gateOpen = live.prog.required.complete && missingItems.length === 0;
  const doneCount = onboardingTemplate.filter((i) => isDone(i.id)).length;
  return { c, live, manual, exception, auto, isDone, missingItems, gateOpen, doneCount };
}

export function ClientOnboarding() {
  const [sel, setSel] = useState(onboardingClients[0]!.id);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-2">
        {onboardingClients.map((c) => (
          <ClientCard key={c.id} id={c.id} selected={sel === c.id} onSelect={() => setSel(c.id)} />
        ))}
      </div>
      <Detail key={sel} id={sel} />
    </div>
  );
}

function ClientCard({ id, selected, onSelect }: { id: string; selected: boolean; onSelect: () => void }) {
  const { c, live, gateOpen, exception } = useClientState(id);
  const { prog, win } = live;
  const status = !live.r.sentOn ? "Not sent" : gateOpen ? (prog.later.complete ? "Completed" : "Gate open") : exception ? "Exception" : "In progress";
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full cursor-pointer rounded-2xl border bg-card p-4 text-left shadow-card transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
        selected ? "border-primary ring-2 ring-primary/15" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-body font-semibold">{c.name}</span>
        <Badge tone={status === "Not sent" ? "neutral" : status === "Exception" ? "warning" : gateOpen ? "success" : "info"}>{status}</Badge>
      </div>
      <div className="mt-1 text-body text-muted-foreground">
        {c.packageName} · won {format(parseISO(c.wonOn), "d MMM")}
      </div>
      <div className="mt-3 space-y-2">
        <MiniMeter label="Required" answered={prog.required.answered} total={prog.required.total} tone={prog.required.complete ? "success" : "accent"} />
        <MiniMeter label="Within 7 days" answered={prog.later.answered} total={prog.later.total} tone={prog.later.complete ? "success" : win.state === "due-soon" || win.state === "overdue" ? "warning" : "info"} />
      </div>
      {live.r.sentOn && !prog.later.complete && <div className={cn("mt-2 text-body", win.state === "due-soon" || win.state === "overdue" ? "text-warning" : "text-muted-foreground")}>{win.label}</div>}
    </button>
  );
}

function MiniMeter({ label, answered, total, tone }: { label: string; answered: number; total: number; tone: "success" | "accent" | "warning" | "info" }) {
  return (
    <div>
      <div className="flex justify-between text-body text-muted-foreground">
        <span>{label}</span>
        <span className="tabular">
          {answered}/{total}
        </span>
      </div>
      <Progress className="mt-1" value={total ? (answered / total) * 100 : 0} tone={tone} />
    </div>
  );
}

function Detail({ id }: { id: string }) {
  const s = useClientState(id);
  const { c, live, missingItems, gateOpen, exception } = s;
  const { r, prog } = live;
  const requestException = useCrmDemo((st) => st.requestException);
  const log = useDemo((st) => st.log);
  const [exOpen, setExOpen] = useState(false);
  const [reason, setReason] = useState("");
  const openRequired = prog.required.sections.filter((p) => !p.complete);
  const missingText = [
    ...(!r.sentOn ? ["questionnaire not sent"] : openRequired.map((p) => `${p.section.title.toLowerCase()} (${p.answered}/${p.total})`)),
    ...missingItems.map((m) => m.label.toLowerCase()),
  ];

  return (
    <div className="min-w-0 space-y-4">
      <Card className={cn("overflow-hidden", gateOpen ? "border-success/40" : exception ? "border-warning/40" : "border-danger/30")}>
        <div className={cn("flex flex-col gap-4 p-5 sm:flex-row sm:items-center", gateOpen ? "bg-success-soft/40" : exception ? "bg-warning-soft/40" : "bg-danger-soft/40")}>
          <span
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
              gateOpen ? "bg-success-soft text-success ring-1 ring-success/30" : exception ? "bg-warning-soft text-warning ring-1 ring-warning/30" : "bg-danger-soft text-danger ring-1 ring-danger/30",
            )}
          >
            {gateOpen ? <LockOpen className="size-5" /> : exception ? <ShieldQuestion className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-body font-medium text-muted-foreground">Onboarding gate · required answers + mandatory checklist</div>
            <div className="text-subheading font-semibold">
              {gateOpen ? "Clear — production can start" : exception ? "Exception requested — awaiting Janarthanan" : `Production blocked · ${missingText.length} item${missingText.length > 1 ? "s" : ""} pending`}
            </div>
            <div className="text-body text-muted-foreground">
              {gateOpen
                ? `First cycle starts ${format(parseISO(c.targetStart), "d MMM yyyy")}. Deeper questions never block work.`
                : exception
                  ? `Reason: ${exception}`
                  : `Missing: ${missingText.join(", ")}`}
            </div>
          </div>
          {!gateOpen && !exception && (
            <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => setExOpen(true)}>
              <ShieldAlert /> Request exception
            </Button>
          )}
        </div>
      </Card>

      <QuestionnaireCard id={id} />

      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent-strong" /> Built from the answers
            </CardTitle>
            <CardDescription>Outputs fill in as sections are answered — nobody retypes anything.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="canvas">
            <TabsList>
              <TabsTrigger value="canvas">Business Canvas</TabsTrigger>
              <TabsTrigger value="matrix">Customer Product Matrix</TabsTrigger>
              <TabsTrigger value="pillars">Content pillars</TabsTrigger>
            </TabsList>
            <TabsContent value="canvas">
              <BusinessCanvas answers={r.answers} sections={prog.all} />
            </TabsContent>
            <TabsContent value="matrix">
              <ProductMatrix answers={r.answers} />
            </TabsContent>
            <TabsContent value="pillars">
              <ContentPillars r={r} sections={prog.all} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Checklist id={id} />

      <Dialog open={exOpen} onOpenChange={setExOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request gate exception</DialogTitle>
            <DialogDescription>Start production before onboarding is complete. The founder is notified and the exception is logged.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="rounded-lg bg-muted/60 p-3 text-body">
              <b>Still missing:</b> {missingText.join(", ")}
            </div>
            <Field label="Reason" required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Deepavali content must be shot by 5 Oct; brand files promised by Monday" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              onClick={() => {
                requestException(id, reason.trim());
                log(`Onboarding exception requested for ${c.name}`, "warning");
                toast("Exception sent to Janarthanan", { description: "You'll be notified when it's approved" });
                setExOpen(false);
              }}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionnaireCard({ id }: { id: string }) {
  const { c, live } = useClientState(id);
  const { r, prog, win, windowDays } = live;
  const send = useOnboarding((s) => s.send);
  const remind = useOnboarding((s) => s.remind);
  const log = useDemo((s) => s.log);
  const [dialog, setDialog] = useState<"send" | "remind" | null>(null);
  const openSections = prog.all.filter((p) => !p.complete).length;
  const first = r.contact.split(" ")[0]!;

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" /> Onboarding questionnaire
          </CardTitle>
          <CardDescription>
            {clientTemplate.name} {clientTemplate.version} ·{" "}
            {r.sentOn
              ? r.mode === "assisted"
                ? `filled with ${c.ownerName.split(" ")[0]} on a call, ${fmtDay(r.sentOn)}`
                : `sent by WhatsApp link on ${fmtDay(r.sentOn)}`
              : "not sent yet"}{" "}
            · {c.contact} · {inr(c.monthlyFee)}/mo
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {!r.sentOn ? (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/onboarding/${id}`}>
                  <PhoneCall /> Fill with client
                </Link>
              </Button>
              <Button size="sm" onClick={() => setDialog("send")}>
                <Send /> Send link
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild>
                <a href={`/q/${r.token}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Client&apos;s link
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/onboarding/${id}`}>
                  <PhoneCall /> Continue with client
                </Link>
              </Button>
              {!prog.later.complete && (
                <Button size="sm" variant="soft" onClick={() => setDialog("remind")}>
                  <Bell /> Remind
                </Button>
              )}
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Meter title="Required to start" p={prog.required} note={prog.required.complete ? "Answered — unlocks the gate" : "Needed before production"} />
          <Meter title={`Complete within ${windowDays} days`} p={prog.later} note={r.sentOn ? win.label : "Starts when the link is sent"} warn={win.state === "due-soon" || win.state === "overdue"} />
        </div>
        {r.sentOn && <Timeline id={id} />}
        <div className="flex flex-wrap gap-1.5">
          {prog.all.map((p) => (
            <SectionChip key={p.section.id} p={p} />
          ))}
        </div>
      </CardContent>

      <WhatsAppSendDialog
        open={dialog === "send"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Send onboarding questionnaire"
        description="The client gets a personal link. Required sections take about 8 minutes."
        to={{ name: r.contact, phone: r.phone }}
        templateId="onboarding_link"
        vars={{ name: first }}
        onSend={() => {
          send(id, "link");
          log(`Onboarding questionnaire sent to ${c.name}`, "accent");
          toast.success("Questionnaire sent on WhatsApp", { description: `Genie Assistant will remind ${first} on day ${REMINDER_DAYS.join(" and day ")}.` });
        }}
      />
      <WhatsAppSendDialog
        open={dialog === "remind"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Send a reminder now"
        description="Genie Assistant already reminds on day 2 and day 5. Use this for an extra nudge."
        to={{ name: r.contact, phone: r.phone }}
        templateId="onboarding_reminder"
        vars={{ name: first, open: openSections, due: win.dueOn ?? "" }}
        sendLabel="Send reminder"
        onSend={() => {
          remind(id, "WhatsApp");
          toast.success("Reminder sent", { description: `${first} will open the questionnaire at the next unanswered question.` });
        }}
      />
    </Card>
  );
}

function Meter({ title, p, note, warn }: { title: string; p: { answered: number; total: number; complete: boolean; done: number; sections: SectionProgress[] }; note: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body font-semibold">{title}</span>
        <span className="text-body tabular text-muted-foreground">
          {p.done}/{p.sections.length} sections · {p.answered}/{p.total} questions
        </span>
      </div>
      <Progress className="mt-2" value={p.total ? (p.answered / p.total) * 100 : 0} tone={p.complete ? "success" : warn ? "warning" : "accent"} />
      <div className={cn("mt-1.5 text-body", warn ? "text-warning" : "text-muted-foreground")}>{note}</div>
    </div>
  );
}

function SectionChip({ p }: { p: SectionProgress }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-body",
        p.complete ? "border-success/30 bg-success-soft/50 text-success" : p.answered ? "border-border bg-surface" : "border-dashed border-border-strong text-muted-foreground",
      )}
    >
      {p.complete ? <Check className="size-3.5" /> : p.section.when === "required" ? <Lock className="size-3" /> : null}
      <span className={cn(p.complete ? "" : "text-text-secondary")}>{p.section.title}</span>
      {!p.complete && (
        <span className="tabular text-muted-foreground">
          {p.answered}/{p.total}
        </span>
      )}
    </span>
  );
}

function Timeline({ id }: { id: string }) {
  const { c, live } = useClientState(id);
  const { r, prog, win, windowDays } = live;
  const sent = parseISO(r.sentOn!);
  const on = (d: number) => format(new Date(sent.getTime() + d * 864e5), "d MMM");
  const sentReminder = (d: number) => r.reminders.find((x) => x.day === d);
  const manual = r.reminders.filter((x) => x.day < 0);
  const steps: { label: string; sub: string; state: "done" | "next" | "todo" | "warn" }[] = [
    { label: r.mode === "assisted" ? "Filled on a call" : "Link sent", sub: fmtDay(r.sentOn!), state: "done" },
    ...REMINDER_DAYS.map((d) => {
      const rem = sentReminder(d);
      const passed = win.day >= d;
      return {
        label: `Day ${d} reminder`,
        sub: prog.later.complete && !rem ? "Not needed" : rem ? `${fmtDay(rem.on)} · ${rem.channel}` : on(d),
        state: (rem || (passed && prog.later.complete) ? "done" : passed ? "done" : "todo") as "done" | "todo",
      };
    }),
    ...manual.map((m) => ({ label: "Extra reminder", sub: `${fmtDay(m.on)} · ${m.channel}`, state: "done" as const })),
    {
      label: prog.later.complete ? "All answered" : `Due day ${windowDays}`,
      sub: prog.later.complete ? "Complete" : (win.dueOn ?? ""),
      state: prog.later.complete ? "done" : win.state === "due-soon" ? "next" : win.state === "overdue" ? "warn" : "todo",
    },
    {
      label: `Flag to ${c.ownerName.split(" ")[0]}`,
      sub: prog.later.complete ? "Not needed" : "If still open after the due date",
      state: prog.later.complete ? "done" : win.state === "overdue" ? "warn" : "todo",
    },
  ];
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:gap-0" aria-label="Questionnaire timeline">
      {steps.map((st, i) => (
        <li key={st.label + i} className="relative flex-1 lg:pr-3">
          {i < steps.length - 1 && <span className="absolute left-4 right-0 top-3 hidden h-px bg-border lg:block" aria-hidden />}
          <span
            className={cn(
              "relative inline-flex size-6 items-center justify-center rounded-full text-body ring-4 ring-card",
              st.state === "done" && "bg-success text-success-foreground",
              st.state === "next" && "bg-warning text-white",
              st.state === "warn" && "bg-danger text-white",
              st.state === "todo" && "border border-border-strong bg-card text-muted-foreground",
            )}
          >
            {st.state === "done" ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
          </span>
          <div className="mt-1.5 text-body font-medium">{st.label}</div>
          <div className="text-body text-muted-foreground">{st.sub}</div>
        </li>
      ))}
    </ol>
  );
}

function Checklist({ id }: { id: string }) {
  const { c, auto, isDone, doneCount, live } = useClientState(id);
  const toggleOnboarding = useCrmDemo((s) => s.toggleOnboarding);
  const log = useDemo((s) => s.log);
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle>Onboarding checklist</CardTitle>
          <CardDescription>
            {doneCount}/{onboardingTemplate.length} done · items marked “from questionnaire” tick themselves when {c.contact.split(" ")[0]} answers
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {onboardingTemplate.map((item) => {
          const fromQ = auto(item.id);
          const checked = isDone(item.id);
          return (
            <label key={item.id} className={cn("flex items-center gap-3 py-3 first:pt-0", fromQ ? "cursor-default" : "cursor-pointer")}>
              <Checkbox
                checked={checked}
                disabled={fromQ}
                onCheckedChange={() => {
                  toggleOnboarding(id, item.id, c.initialDone);
                  if (!checked) log(`${c.name}: ${item.label} ✓`, "success");
                }}
              />
              <div className="min-w-0 flex-1">
                <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-body font-medium", checked && "text-muted-foreground line-through")}>
                  {item.label}
                  {item.mandatory && !checked && <Badge tone="danger">Required</Badge>}
                  {!item.mandatory && !checked && <Badge tone="neutral">Optional</Badge>}
                  {fromQ && (
                    <Badge tone="success" className="no-underline">
                      <Sparkles /> From questionnaire
                    </Badge>
                  )}
                  {!fromQ && AUTO[item.id] && live.r.sentOn && !checked && <Badge tone="outline">Waiting for {AUTO[item.id]!.from}</Badge>}
                </div>
                <div className="text-body text-muted-foreground">{item.detail}</div>
              </div>
              <div className="hidden items-center gap-1.5 text-body text-muted-foreground sm:flex">
                <Avatar name={item.owner} size="xs" /> {item.owner.split(" ")[0]}
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}
