"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Copy,
  DoorOpen,
  Landmark,
  Link2,
  Lock,
  MessageCircle,
  PencilLine,
  Play,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { type AnswerValue, FILE_REF, isAnswered, LANGUAGES, type OnboardingDetail, type OnboardingSummary } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { NoteDialog } from "./deals";
import { fmtDate } from "./format";
import { startFor } from "./files";
import { QuestionnaireForm } from "./questionnaire";
import {
  useAgency,
  useCan,
  useClient,
  useClients,
  useOnboarding,
  useOnboardingLink,
  useOnboardingList,
  useOnboardingStep,
  useSaveAnswer,
  useStartOnboarding,
} from "./queries";

/** Where an onboarding stands, in one label. */
export function onboardingStatus(o: Pick<OnboardingSummary, "progress" | "gate" | "window" | "sentAt">): { label: string; tone: BadgeTone } {
  if (o.progress.complete) return { label: "Complete", tone: "success" };
  if (o.window.state === "overdue") return { label: o.gate.open ? "Gate open · answers overdue" : "Overdue", tone: "danger" };
  if (o.gate.open) return { label: o.gate.byException ? "Gate open by exception" : "Gate open", tone: "success" };
  if (!o.sentAt) return { label: "Not shared yet", tone: "neutral" };
  if (o.progress.required.complete) return { label: "Required done · checklist open", tone: "info" };
  return { label: "Waiting for answers", tone: "warning" };
}

const pct = (p: { answered: number; total: number }) => (p.total ? Math.round((p.answered / p.total) * 100) : 100);

/** An answer as text, for reading. */
export function AnswerText({ value, files }: { value: AnswerValue; files?: Record<string, { name: string; url: string | null }> }) {
  if (typeof value === "string") return <span className="whitespace-pre-line">{value}</span>;
  if (!value.length) return <span className="text-muted-foreground">—</span>;
  if (typeof value[0] === "string") {
    const items = value as string[];
    // A files answer: uploaded files by name, and links.
    if (items.some((v) => FILE_REF.test(v) || /^https?:\/\//.test(v)))
      return (
        <span className="flex flex-col">
          {items.map((v) => {
            const f = FILE_REF.test(v) ? files?.[v.slice(5)] : null;
            const href = f ? f.url : /^https?:\/\//.test(v) ? v : null;
            const text = f ? f.name : FILE_REF.test(v) ? "Uploaded file" : v;
            return href ? (
              <a key={v} href={href} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
                {text}
              </a>
            ) : (
              <span key={v}>{text}</span>
            );
          })}
        </span>
      );
    return <span>{items.join(", ")}</span>;
  }
  const rows = value as Record<string, string>[];
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="text-body">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border-subtle last:border-0">
              {cols.map((c) => (
                <td key={c} className={cn("py-1 pr-4", c === "row" && "font-medium")}>
                  {r[c] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── The list ─────────────────────────────────────────────────────────

export function LiveOnboardingList() {
  const router = useRouter();
  const can = useCan();
  const list = useOnboardingList();
  const clients = useClients();
  const start = useStartOnboarding();
  const started = new Set((list.data ?? []).map((o) => o.client?.id));
  const notStarted = (clients.data ?? []).filter((c) => !c.archivedAt && !started.has(c.id));

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Each new client answers the onboarding questions — by private link, or with you on a call. Production starts when the required part and the checklist are done."
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/app/onboarding/agency">
                <Landmark />
                Your agency questionnaire
              </Link>
            </Button>
            {can("settings", "edit") && (
              <Button variant="secondary" asChild>
                <Link href="/app/settings/onboarding">
                  <PencilLine />
                  Change the questions
                </Link>
              </Button>
            )}
          </>
        }
      />
      <Card className="overflow-hidden">
        {list.isPending ? (
          <div className="p-4">
            <SkeletonRows rows={4} />
          </div>
        ) : list.error ? (
          <div className="p-4">
            <Alert tone="danger">{errorMessage(list.error)}</Alert>
          </div>
        ) : !list.data.length ? (
          <EmptyState
            icon={ClipboardList}
            title="No client onboarding yet"
            description="It starts by itself when a deal is won, or start it for a client below."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Client</TH>
                <TH>Status</TH>
                <TH>Required</TH>
                <TH>Within the window</TH>
                <TH>Started</TH>
              </TR>
            </THead>
            <TBody>
              {list.data.map((o) => {
                const s = onboardingStatus(o);
                return (
                  <TR key={o.id} className="cursor-pointer" onClick={() => router.push(`/app/onboarding/${o.id}`)}>
                    <TD>
                      <Link href={`/app/onboarding/${o.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {o.client?.name}
                      </Link>
                      <div className="text-muted-foreground">
                        {o.mode === "assisted" ? "Filled in with the client" : "By private link"} · questions v{o.version}
                      </div>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={s.tone} dot>
                          {s.label}
                        </Badge>
                        {o.remindersDue.length > 0 && (
                          <Badge tone="warning">
                            <BellRing />
                            Reminder due
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD className="min-w-32">
                      <Progress value={pct(o.progress.required)} tone={o.progress.required.complete ? "success" : "accent"} />
                      <div className="mt-1 tabular text-muted-foreground">
                        {o.progress.required.answered}/{o.progress.required.total}
                      </div>
                    </TD>
                    <TD className="min-w-32">
                      <Progress value={pct(o.progress.window)} tone={o.progress.window.complete ? "success" : "accent"} />
                      <div className="mt-1 tabular text-muted-foreground">
                        {o.progress.window.answered}/{o.progress.window.total}
                        {o.window.dueOn && !o.progress.complete && ` · by ${fmtDate(o.window.dueOn)}`}
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap">{fmtDate(o.createdAt)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
      {can("onboarding", "edit") && notStarted.length > 0 && (
        <SectionCard title="Clients without onboarding" description="For clients added by hand or imported. Won deals start it by themselves." className="mt-4">
          <ul className="divide-y divide-border-subtle">
            {notStarted.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-body">
                  <span className="font-medium">{c.name}</span> <span className="font-mono text-muted-foreground">{c.code}</span>
                </span>
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={start.isPending}
                  onClick={() =>
                    start.mutate({ clientId: c.id }, { onSuccess: (o) => router.push(`/app/onboarding/${o.id}`), onError: (e) => toast.error(errorMessage(e)) })
                  }
                >
                  <Play />
                  Start
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}

// ─── One client's onboarding ──────────────────────────────────────────

const waLink = (phone: string | undefined, text: string) => `https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

function ShareDialog({ o, open, onOpenChange }: { o: OnboardingDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const link = useOnboardingLink();
  const agency = useAgency();
  const client = useClient(o.client!.id);
  const approver = client.data?.contacts.find((c) => c.approver) ?? client.data?.contacts[0];
  const [url, setUrl] = useState<string | null>(null);
  const message = url
    ? `Hello ${approver?.name ?? ""}, welcome to ${agency.data?.name ?? "us"}! Please answer your onboarding questions here: ${url}\n\nThe first part takes about 10 minutes and lets us start work. The rest can be answered within ${o.windowDays} days. Your answers save as you type.`
    : "";
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setUrl(null);
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share the questionnaire with {o.client!.name}</DialogTitle>
          <DialogDescription>
            A private link only this client can use. For safety it is shown once: copy it or send it now.{" "}
            {o.sentAt && "Making a new link stops the earlier one working."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {!url ? (
            <Button
              disabled={link.isPending}
              onClick={() => link.mutate(o.id, { onSuccess: (r) => setUrl(r.link), onError: (e) => toast.error(errorMessage(e)) })}
            >
              <Link2 />
              {o.sentAt ? "Make a new link" : "Make the link"}
            </Button>
          ) : (
            <>
              <div className="flex gap-2">
                <Input readOnly value={url} aria-label="Link" className="font-mono" onFocus={(e) => e.target.select()} />
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}
                  aria-label="Copy the link"
                >
                  <Copy />
                </Button>
              </div>
              <Button asChild variant="success">
                <a href={waLink(approver?.phone, message)} target="_blank" rel="noreferrer">
                  <MessageCircle />
                  Send on WhatsApp{approver ? ` to ${approver.name}` : ""}
                </a>
              </Button>
              <p className="text-body text-muted-foreground">The window of {o.windowDays} days starts from the first time the link is made.</p>
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Reminders({ o, canEdit }: { o: OnboardingDetail; canEdit: boolean }) {
  const step = useOnboardingStep(o.id);
  const agency = useAgency();
  const client = useClient(o.client!.id);
  const approver = client.data?.contacts.find((c) => c.approver) ?? client.data?.contacts[0];
  const sent = new Map(o.reminders.map((r) => [r.day, r]));
  const text = `Hello ${approver?.name ?? ""}, a gentle reminder from ${agency.data?.name ?? "us"}: please finish your onboarding questions using the link we sent${o.window.dueOn ? ` — by ${fmtDate(o.window.dueOn)}` : ""}. It helps us plan your content. Thank you!`;
  return (
    <SectionCard title="Reminders" description={`On day ${o.reminderDays.join(" and day ")} of the ${o.windowDays}-day window, until it is complete.`}>
      {!o.sentAt ? (
        <p className="text-body text-muted-foreground">They start once the link is shared.</p>
      ) : (
        <ul className="space-y-2">
          {o.reminderDays.map((day) => {
            const r = sent.get(day);
            const due = o.remindersDue.includes(day);
            return (
              <li key={day} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <span className="text-body">
                  <span className="font-medium">Day {day}</span>{" "}
                  {r ? (
                    <span className="text-muted-foreground">
                      · sent {r.by?.name ? `by ${r.by.name} ` : ""}on {fmtDate(r.sentAt)}
                    </span>
                  ) : due ? (
                    <Badge tone="warning">Due now</Badge>
                  ) : o.progress.complete ? (
                    <span className="text-muted-foreground">· not needed</span>
                  ) : (
                    <span className="text-muted-foreground">· coming</span>
                  )}
                </span>
                {due && canEdit && (
                  <span className="flex gap-2">
                    <Button size="xs" variant="success" asChild>
                      <a href={waLink(approver?.phone, text)} target="_blank" rel="noreferrer">
                        <MessageCircle />
                        Send on WhatsApp
                      </a>
                    </Button>
                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={() => step.mutate({ step: "reminder", day }, { onSuccess: () => toast.success(`Day ${day} reminder recorded`) })}
                    >
                      Mark as sent
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-body text-muted-foreground">
        Sending them by itself on WhatsApp and email comes later; for now you send them and record it here.
      </p>
    </SectionCard>
  );
}

export function LiveOnboardingDetail({ id }: { id: string }) {
  const can = useCan();
  const onboarding = useOnboarding(id);
  const [sharing, setSharing] = useState(false);
  const [excepting, setExcepting] = useState(false);
  const step = useOnboardingStep(id);

  if (onboarding.isPending) return <SkeletonRows rows={8} />;
  if (onboarding.error) return <Alert tone="danger">{errorMessage(onboarding.error)}</Alert>;
  const o = onboarding.data;
  if (!o.client) return <Alert tone="info">This is the agency questionnaire.</Alert>;
  const canEdit = can("onboarding", "edit");
  const status = onboardingStatus(o);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/onboarding">
          <ArrowLeft />
          Onboarding
        </Link>
      </Button>
      <PageHeader
        eyebrow={
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        }
        title={
          <Link href={`/app/clients/${o.client.id}`} className="hover:underline">
            {o.client.name}
          </Link>
        }
        description={`Questions version ${o.version} · ${o.mode === "assisted" ? "filled in with the client" : "by private link"}${o.sentAt ? ` · started ${fmtDate(o.sentAt)}` : ""}`}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" asChild>
                <Link href={`/app/onboarding/${o.id}/fill`}>
                  <UserRound />
                  Fill in with the client
                </Link>
              </Button>
              <Button onClick={() => setSharing(true)}>
                <Link2 />
                {o.sentAt ? "Share again" : "Share the link"}
              </Button>
            </>
          )
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Card className={cn("p-5", o.gate.open ? "border-success/40" : "border-warning/40")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex size-10 items-center justify-center rounded-xl",
                    o.gate.open ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                  )}
                >
                  {o.gate.open ? <DoorOpen className="size-5" /> : <Lock className="size-5" />}
                </span>
                <div>
                  <div className="text-subheading font-semibold">{o.gate.open ? "Production can start" : "Production waits"}</div>
                  <div className="text-body text-muted-foreground">
                    {o.gate.open
                      ? o.gate.byException
                        ? `By exception: “${o.exception?.reason}” — approved by ${o.exception?.by?.name ?? "a former team member"}.`
                        : "The required answers and the mandatory checklist are done."
                      : `Still needed: ${o.gate.missing.join(", ")}.`}
                  </div>
                </div>
              </div>
              {!o.gate.open && can("onboarding", "approve") && (
                <Button variant="secondary" onClick={() => setExcepting(true)}>
                  <ShieldCheck />
                  Let production start anyway
                </Button>
              )}
            </div>
          </Card>

          <Tabs defaultValue="answers">
            <TabsList>
              <TabsTrigger value="answers">Answers</TabsTrigger>
              <TabsTrigger value="canvas">Business Canvas</TabsTrigger>
              <TabsTrigger value="filled">Filled in</TabsTrigger>
            </TabsList>
            <TabsContent value="answers" className="space-y-4">
              {o.definition.sections.map((s) => {
                const p = o.progress.sections.find((x) => x.key === s.key)!;
                return (
                  <SectionCard
                    key={s.key}
                    title={s.title}
                    description={`${s.when === "required" ? "Required to start" : `Within ${o.windowDays} days`} · ${p.answered}/${p.total} answered`}
                  >
                    <dl className="divide-y divide-border-subtle">
                      {s.questions.map((q) => {
                        const a = o.answers[q.key];
                        return (
                          <div key={q.key} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                            <dt className="text-body font-medium text-text-secondary">{q.label}</dt>
                            <dd className="min-w-0 text-body">
                              {a && isAnswered(a.value) ? (
                                <>
                                  <AnswerText value={a.value} files={o.files} />
                                  <div className="mt-0.5 text-muted-foreground">
                                    {a.by ? `Entered by ${a.by.name ?? "a former team member"}` : "Answered by the client"} · {fmtDate(a.at)}
                                  </div>
                                </>
                              ) : (
                                <span className="text-muted-foreground">Not answered{q.showIf ? " (shown only for some answers)" : ""}</span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </SectionCard>
                );
              })}
            </TabsContent>
            <TabsContent value="canvas">
              <Alert tone="info" icon={Sparkles} className="mb-4">
                A first draft, put together from the client&apos;s answers. Review it with the client at the kick-off.
              </Alert>
              <div className="grid gap-4 md:grid-cols-2">
                {o.canvas.map((b) => (
                  <SectionCard key={b.block} title={b.label}>
                    {b.items.length ? (
                      <ul className="space-y-3">
                        {b.items.map((it) => (
                          <li key={it.question} className="text-body">
                            <div className="text-muted-foreground">{it.question}</div>
                            <AnswerText value={it.answer} files={o.files} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-body text-muted-foreground">Waiting for answers.</p>
                    )}
                  </SectionCard>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="filled">
              <SectionCard title="Fields filled in from answers" description="Set in the question builder: an answer can fill a field on the client's profile.">
                {o.filled.length ? (
                  <ul className="divide-y divide-border-subtle">
                    {o.filled.map((f) => (
                      <li key={f.field} className="flex flex-wrap justify-between gap-2 py-2 text-body">
                        <span>
                          <span className="font-medium">{f.field}</span>
                          <span className="block text-muted-foreground">from “{f.question}”</span>
                        </span>
                        <span>
                          {f.value && isAnswered(f.value) ? <AnswerText value={f.value} /> : <span className="text-muted-foreground">Not answered yet</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body text-muted-foreground">No question fills a field yet.</p>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <SectionCard title="Progress">
            <div className="space-y-3 text-body">
              <div>
                <div className="flex justify-between">
                  <span className="font-medium">Required to start</span>
                  <span className="tabular text-muted-foreground">
                    {o.progress.required.answered}/{o.progress.required.total}
                  </span>
                </div>
                <Progress className="mt-1.5" value={pct(o.progress.required)} tone={o.progress.required.complete ? "success" : "accent"} />
              </div>
              <div>
                <div className="flex justify-between">
                  <span className="font-medium">Within {o.windowDays} days</span>
                  <span className="tabular text-muted-foreground">
                    {o.progress.window.answered}/{o.progress.window.total}
                  </span>
                </div>
                <Progress className="mt-1.5" value={pct(o.progress.window)} tone={o.progress.window.complete ? "success" : "accent"} />
                <div className="mt-1 text-muted-foreground">
                  {o.window.state === "not_sent"
                    ? "The window starts when the link is shared."
                    : o.window.state === "complete"
                      ? "Complete."
                      : `Day ${o.window.day} of ${o.windowDays}${o.window.dueOn ? ` · due ${fmtDate(o.window.dueOn)}` : ""}${o.window.state === "overdue" ? " · overdue" : ""}`}
                </div>
              </div>
              {o.languages.length > 1 && canEdit && (
                <label className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Client&apos;s language</span>
                  <Select
                    aria-label="Client's language"
                    className="w-40"
                    value={o.language}
                    onValueChange={(language) => step.mutate({ step: "update", language })}
                    options={o.languages.map((code) => ({ value: code, label: LANGUAGES.find((l) => l.code === code)?.label ?? code }))}
                  />
                </label>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Checklist" description="Mandatory items must be done before production starts.">
            <ul className="space-y-2">
              {o.checklist.map((c) => (
                <li key={c.key} className="flex items-start gap-2.5 text-body">
                  {c.auto ? (
                    <span className={cn("mt-0.5 inline-flex size-4 items-center justify-center rounded", c.done ? "text-success" : "text-muted-foreground")}>
                      {c.done ? <CheckCircle2 className="size-4" /> : <ClipboardCheck className="size-4" />}
                    </span>
                  ) : (
                    <Checkbox
                      className="mt-0.5"
                      checked={c.done}
                      disabled={!canEdit || step.isPending}
                      aria-label={c.label}
                      onCheckedChange={(v) => step.mutate({ step: "tick", key: c.key, done: v === true }, { onError: (e) => toast.error(errorMessage(e)) })}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("font-medium", c.done && "text-muted-foreground line-through")}>{c.label}</span>
                    {c.mandatory && !c.done && <span className="ml-1 text-danger">*</span>}
                    <span className="block text-muted-foreground">
                      {c.auto
                        ? c.tick.kind === "answer"
                          ? "Ticks itself from the client's answer"
                          : c.tick.kind === "section"
                            ? "Ticks itself when the section is answered"
                            : c.tick.kind === "agreement"
                              ? "Ticks itself when an agreement is signed"
                              : "Ticks itself when a contact approves the work"
                        : c.done && c.by
                          ? `Ticked by ${c.by.name ?? "a former team member"}`
                          : c.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <Reminders o={o} canEdit={canEdit} />
          {o.mode === "link" && !o.sentAt && <Alert tone="info">Share the link, or fill it in with the client on a call — both work any time.</Alert>}
        </div>
      </div>

      {sharing && <ShareDialog o={o} open onOpenChange={setSharing} />}
      <NoteDialog
        open={excepting}
        title="Let production start before onboarding is complete"
        description={`Still missing: ${o.gate.missing.join(", ")}. Say why it is fine to start — it is kept with the client.`}
        required
        confirm="Approve the exception"
        onClose={() => setExcepting(false)}
        onConfirm={(reason) => {
          setExcepting(false);
          step.mutate({ step: "exception", reason }, { onSuccess: () => toast.success("Production can start"), onError: (e) => toast.error(errorMessage(e)) });
        }}
      />
    </>
  );
}

// ─── Filling it in with the client ────────────────────────────────────

export function LiveOnboardingFill({ id }: { id: string }) {
  const onboarding = useOnboarding(id);
  const save = useSaveAnswer(id);
  if (onboarding.isPending) return <SkeletonRows rows={8} />;
  if (onboarding.error) return <Alert tone="danger">{errorMessage(onboarding.error)}</Alert>;
  const o = onboarding.data;
  // The form keeps its own answers while open; these only set it up.
  const answers = Object.fromEntries(Object.entries(o.answers).map(([k, a]) => [k, a.value]));
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href={`/app/onboarding/${id}`}>
          <ArrowLeft />
          {o.client?.name ?? "Onboarding"}
        </Link>
      </Button>
      <PageHeader
        title={`Fill in with ${o.client?.name ?? "the client"}`}
        description="On a call or in a meeting: each answer saves as you go and is recorded as entered by you."
      />
      <QuestionnaireForm
        key={o.id}
        sections={o.definition.sections}
        initial={answers}
        windowDays={o.windowDays}
        dueOn={o.window.dueOn}
        mode="assisted"
        save={save}
        upload={startFor("onboarding", o.id)}
        files={o.files}
      />
    </>
  );
}
