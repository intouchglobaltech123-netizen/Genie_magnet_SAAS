"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  FileBarChart,
  FileText,
  Film,
  LinkIcon,
  ListChecks,
  MessageSquare,
  Printer,
  Receipt,
  Send,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  CLIENT_REQUEST_KINDS,
  type ClientRequestKind,
  type ClientRequestRow,
  type Invoice,
  type MonthlyReport,
  parseVideoTime,
  type PortalHome,
  type PortalInvoiceRow,
  type PortalScript,
  type PortalTopicList,
  type PortalVideo,
  type PortalVideos,
  videoTime,
} from "@gm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api, ApiError, errorMessage } from "./api";
import { fmtDate } from "./format";
import { InvoiceDocument } from "./invoices";
import { ReportDocument } from "./report-document";
import { inr, PLATFORM_LABEL } from "./packages";

type Tab = "home" | "topics" | "scripts" | "videos" | "invoices" | "reports" | "ask";
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** Reads one part of the portal; every part refreshes after the client acts. */
function usePortal<T>(token: string, path: string) {
  return useQuery({ queryKey: ["portal", token, path], queryFn: () => api<T>(`/portal/${token}${path}`) });
}

function Decision({ onDecide, pending, approveLabel }: { onDecide: (approved: boolean, note?: string) => void; pending: boolean; approveLabel: string }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  return asking ? (
    <div className="space-y-2">
      <Field label="What would you like changed?">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!note.trim() || pending} onClick={() => onDecide(false, note.trim())}>
          <Send />
          Send to the team
        </Button>
        <Button variant="ghost" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2">
      <Button variant="success" disabled={pending} onClick={() => onDecide(true)}>
        <ThumbsUp />
        {approveLabel}
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => setAsking(true)}>
        <ThumbsDown />
        Ask for changes
      </Button>
    </div>
  );
}

function Topics({ token }: { token: string }) {
  const qc = useQueryClient();
  const lists = usePortal<PortalTopicList[]>(token, "/topics");
  const [busy, setBusy] = useState(false);
  const pick = async (id: string, value: "picked" | "skipped" | null) => {
    try {
      qc.setQueryData(["portal", token, "/topics"], await api<PortalTopicList[]>(`/portal/${token}/topics/${id}`, { method: "PUT", body: { pick: value } }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (lists.isPending) return <SkeletonRows rows={4} />;
  if (lists.error) return <Alert tone="danger">{errorMessage(lists.error)}</Alert>;
  if (!lists.data.length)
    return <EmptyState icon={ListChecks} title="No topics to pick" description="When the team offers next month's topics, they show here." />;
  return (
    <div className="space-y-6">
      {lists.data.map((l) => {
        const picked = l.items.filter((i) => i.pick === "picked").length;
        return (
          <SectionCard
            key={l.id}
            title={l.status === "sent" ? `Pick ${l.needed} topics for ${monthName(l.month)}` : `Your topics for ${monthName(l.month)}`}
            description={l.status === "sent" ? `${picked} of ${l.needed} picked. Tap Pick on the ones you want.` : "Confirmed — the team is working on these."}
          >
            <ul className="space-y-2">
              {l.items.map((i) => (
                <li
                  key={i.id}
                  className={cn(
                    "rounded-lg border p-3",
                    i.pick === "picked" ? "border-success/40 bg-success-soft/40" : i.pick === "skipped" ? "border-border opacity-60" : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{i.title}</div>
                      <div className="text-body text-muted-foreground">
                        {i.format} · {i.pillar}
                      </div>
                      {i.notes && <p className="mt-1 text-body text-muted-foreground">{i.notes}</p>}
                    </div>
                    {l.status === "sent" && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant={i.pick === "picked" ? "success" : "secondary"}
                          onClick={() => pick(i.id, i.pick === "picked" ? null : "picked")}
                        >
                          {i.pick === "picked" ? <CheckCircle2 /> : null}
                          {i.pick === "picked" ? "Picked" : "Pick"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => pick(i.id, i.pick === "skipped" ? null : "skipped")}>
                          {i.pick === "skipped" ? "Skipped" : "Skip"}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {l.status === "sent" && (
              <Button
                className="mt-4"
                disabled={!picked || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`/portal/${token}/topic-lists/${l.id}/done`, { body: {} });
                    toast.success("Thank you — the team has your picks");
                  } catch (e) {
                    toast.error(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Send />I have picked
              </Button>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

function Scripts({ token, refresh }: { token: string; refresh: () => void }) {
  const scripts = usePortal<PortalScript[]>(token, "/scripts");
  const [pending, setPending] = useState(false);
  if (scripts.isPending) return <SkeletonRows rows={4} />;
  if (scripts.error) return <Alert tone="danger">{errorMessage(scripts.error)}</Alert>;
  if (!scripts.data.length) return <EmptyState icon={FileText} title="No scripts waiting" description="Scripts the team sends you for approval show here." />;
  return (
    <div className="space-y-6">
      {scripts.data.map((s) => (
        <SectionCard key={s.contentId} title={s.title} description={`${s.format} · ${monthName(s.month)} · ${s.script.label}`}>
          <dl className="space-y-3 text-body">
            {(
              [
                ["Hook", s.script.hook],
                ["Script", s.script.body],
                ["Call to action", s.script.cta],
                ["On-screen text", s.script.onScreen],
              ] as const
            ).map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="whitespace-pre-line">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
          {s.earlier.length > 0 && (
            <p className="mt-3 text-body text-muted-foreground">
              Earlier: {s.earlier.map((e) => `${e.label}${e.clientNote ? ` — “${e.clientNote}”` : ""}`).join(" · ")}
            </p>
          )}
          <div className="mt-4">
            <Decision
              approveLabel="Approve the script"
              pending={pending}
              onDecide={async (approved, note) => {
                setPending(true);
                try {
                  await api(`/portal/${token}/scripts/${s.contentId}/decision`, { body: { approved, note } });
                  toast.success(approved ? "Approved — thank you" : "Sent to the team");
                  refresh();
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setPending(false);
                }
              }}
            />
          </div>
        </SectionCard>
      ))}
    </div>
  );
}

function VideoReview({ token, v, refresh }: { token: string; v: PortalVideo; refresh: () => void }) {
  const player = useRef<HTMLVideoElement>(null);
  const [text, setText] = useState("");
  const [at, setAt] = useState("");
  const [pending, setPending] = useState(false);
  const version = v.version!;
  const send = async () => {
    const seconds = at.trim() ? parseVideoTime(at) : undefined;
    if (at.trim() && seconds === undefined) return toast.error("Write the time like 0:12");
    setPending(true);
    try {
      await api(`/portal/${token}/videos/${v.id}/comments`, { body: { text: text.trim(), at: seconds } });
      setText("");
      setAt("");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  };
  return (
    <SectionCard title={v.title} description={`${v.code} · ${version.label}${version.duration ? ` · ${version.duration}` : ""}`}>
      {version.fileUrl ? (
        <video ref={player} src={version.fileUrl} controls playsInline className="mb-3 aspect-video w-full rounded-lg bg-black" />
      ) : version.link ? (
        <Button asChild variant="secondary" className="mb-3">
          <a href={version.link} target="_blank" rel="noreferrer">
            <ExternalLink />
            Watch {version.label}
          </a>
        </Button>
      ) : null}
      {version.notes && <p className="mb-3 text-body text-muted-foreground">From the team: {version.notes}</p>}
      <div className="space-y-2">
        <div className="text-body font-medium">Comments</div>
        {version.comments.length ? (
          <ul className="space-y-1.5 text-body">
            {version.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-secondary px-3 py-2">
                {c.at !== null && <span className="mr-2 font-mono text-primary">{videoTime(c.at)}</span>}
                {c.text}
                <span className="ml-2 text-muted-foreground">— {c.author}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">No comments yet. Pause where you want something changed and say what.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto]">
          <div className="flex gap-1">
            <Input aria-label="At" placeholder="0:12" value={at} onChange={(e) => setAt(e.target.value)} />
            {version.fileUrl && (
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => setAt(videoTime(Math.floor(player.current?.currentTime ?? 0)))}
                title="Use the time where the video is"
              >
                Now
              </Button>
            )}
          </div>
          <Input aria-label="Comment" placeholder="e.g. Make the logo bigger here" value={text} onChange={(e) => setText(e.target.value)} />
          <Button variant="secondary" disabled={!text.trim() || pending} onClick={send}>
            <MessageSquare />
            Comment
          </Button>
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <Decision
          approveLabel="Approve the video"
          pending={pending}
          onDecide={async (approved, note) => {
            setPending(true);
            try {
              await api(`/portal/${token}/videos/${v.id}/decision`, { body: { approved, note } });
              toast.success(approved ? "Approved — thank you" : "Sent to the team");
              refresh();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setPending(false);
            }
          }}
        />
      </div>
    </SectionCard>
  );
}

function Videos({ token, refresh }: { token: string; refresh: () => void }) {
  const videos = usePortal<PortalVideos>(token, "/videos");
  if (videos.isPending) return <SkeletonRows rows={4} />;
  if (videos.error) return <Alert tone="danger">{errorMessage(videos.error)}</Alert>;
  const { waiting, done } = videos.data;
  return (
    <div className="space-y-6">
      {waiting.length ? (
        waiting.map((v) => <VideoReview key={v.id} token={token} v={v} refresh={refresh} />)
      ) : (
        <EmptyState icon={Film} title="No videos waiting for you" description="Videos the team sends for your review show here." />
      )}
      {done.length > 0 && (
        <SectionCard title="Approved and published" contentClassName="p-0">
          <ul className="divide-y divide-border">
            {done.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-body">
                <span>
                  <span className="font-medium">{v.title}</span> <span className="text-muted-foreground">{v.code}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {v.posts.length ? (
                    v.posts.map((p, i) =>
                      p.url ? (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          {PLATFORM_LABEL[p.platform] ?? p.platform}
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <Badge key={i}>{PLATFORM_LABEL[p.platform] ?? p.platform}</Badge>
                      ),
                    )
                  ) : (
                    <Badge tone="success">Approved</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function Invoices({ token }: { token: string }) {
  const rows = usePortal<PortalInvoiceRow[]>(token, "/invoices");
  const [open, setOpen] = useState<string | null>(null);
  const inv = useQuery({ queryKey: ["portal", token, "invoice", open], queryFn: () => api<Invoice>(`/portal/${token}/invoices/${open}`), enabled: !!open });
  if (rows.isPending) return <SkeletonRows rows={3} />;
  if (rows.error) return <Alert tone="danger">{errorMessage(rows.error)}</Alert>;
  if (open)
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="ghost" onClick={() => setOpen(null)}>
            Back to invoices
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer />
            Print or save as PDF
          </Button>
        </div>
        {inv.isPending ? <SkeletonRows rows={8} /> : inv.error ? <Alert tone="danger">{errorMessage(inv.error)}</Alert> : <InvoiceDocument inv={inv.data} />}
      </div>
    );
  if (!rows.data.length) return <EmptyState icon={Receipt} title="No invoices yet" />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-body">
            <span>
              <span className="font-mono font-medium">{r.number}</span>
              <span className="block text-muted-foreground">{r.issueDate ? fmtDate(r.issueDate) : ""}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-medium">{inr(r.total)}</span>
              {r.status === "paid" ? (
                <Badge tone="success">Paid{r.paidOn ? ` ${fmtDate(r.paidOn)}` : ""}</Badge>
              ) : (
                <Badge tone="warning">Due{r.dueDate ? ` ${fmtDate(r.dueDate)}` : ""}</Badge>
              )}
              {r.payUrl && (
                <Button size="sm" asChild>
                  <a href={r.payUrl} target="_blank" rel="noreferrer">
                    Pay now
                  </a>
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setOpen(r.id)}>
                View
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Reports({ token }: { token: string }) {
  const rows = usePortal<{ id: string; month: string; releasedAt: string | null }[]>(token, "/reports");
  const [open, setOpen] = useState<string | null>(null);
  const report = useQuery({
    queryKey: ["portal", token, "report", open],
    queryFn: () => api<MonthlyReport>(`/portal/${token}/reports/${open}`),
    enabled: !!open,
  });
  if (rows.isPending) return <SkeletonRows rows={3} />;
  if (rows.error) return <Alert tone="danger">{errorMessage(rows.error)}</Alert>;
  if (open)
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="ghost" onClick={() => setOpen(null)}>
            Back to reports
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer />
            Print or save as PDF
          </Button>
        </div>
        {report.isPending ? (
          <SkeletonRows rows={8} />
        ) : report.error ? (
          <Alert tone="danger">{errorMessage(report.error)}</Alert>
        ) : (
          <ReportDocument report={report.data} />
        )}
      </div>
    );
  if (!rows.data.length)
    return <EmptyState icon={FileBarChart} title="No reports yet" description="Your monthly report shows here at the end of each month." />;
  return (
    <Card>
      <ul className="divide-y divide-border">
        {rows.data.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-5 py-3 text-body">
            <span className="font-medium">{monthName(r.month)}</span>
            <Button size="sm" variant="secondary" onClick={() => setOpen(r.id)}>
              View
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Ask({ token }: { token: string }) {
  const qc = useQueryClient();
  const mine = usePortal<ClientRequestRow[]>(token, "/requests");
  const [kind, setKind] = useState<ClientRequestKind>("idea");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="space-y-6">
      <SectionCard title="Ask the team" description="An idea for a video, a change, a question — the team answers here.">
        <div className="space-y-3">
          <Field label="About">
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as ClientRequestKind)}
              options={Object.entries(CLIENT_REQUEST_KINDS).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Your message">
            <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Button
            disabled={text.trim().length < 3 || pending}
            onClick={async () => {
              setPending(true);
              try {
                qc.setQueryData(
                  ["portal", token, "/requests"],
                  await api<ClientRequestRow[]>(`/portal/${token}/requests`, { body: { kind, text: text.trim() } }),
                );
                setText("");
                toast.success("Sent — the team will answer here");
              } catch (e) {
                toast.error(e instanceof ApiError && e.body.issues ? e.body.issues[0]!.message : errorMessage(e));
              } finally {
                setPending(false);
              }
            }}
          >
            <Send />
            Send
          </Button>
        </div>
      </SectionCard>
      {!!mine.data?.length && (
        <SectionCard title="What you asked" contentClassName="p-0">
          <ul className="divide-y divide-border">
            {mine.data.map((r) => (
              <li key={r.id} className="px-5 py-3 text-body">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {CLIENT_REQUEST_KINDS[r.kind as ClientRequestKind] ?? r.kind} · {r.contactName} · {fmtDate(r.createdAt)}
                  </span>
                  <Badge tone={r.status === "answered" ? "success" : "neutral"}>{r.status === "answered" ? "Answered" : "Waiting"}</Badge>
                </div>
                <p className="mt-1 whitespace-pre-line">{r.text}</p>
                {r.answer && (
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-primary-soft/50 px-3 py-2">
                    {r.answer}
                    {r.answeredBy?.name && <span className="text-muted-foreground"> — {r.answeredBy.name}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

/** The contact chooses to get updates on WhatsApp — their own consent, kept with how they gave it. */
function WhatsAppChoice({ token, on, agency, onChange }: { token: string; on: boolean; agency: string; onChange: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <Card className="mt-6">
      <CardContent className="flex items-start gap-3 p-4 text-body">
        <Checkbox
          id="whatsapp-updates"
          checked={on}
          disabled={pending}
          onCheckedChange={async (v) => {
            setPending(true);
            try {
              await api(`/portal/${token}/whatsapp`, { method: "PUT", body: { optIn: v === true } });
              toast.success(v === true ? "You will get updates on WhatsApp" : "No more WhatsApp updates");
              onChange();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setPending(false);
            }
          }}
        />
        <label htmlFor="whatsapp-updates" className="cursor-pointer">
          <span className="font-medium">Send me updates on WhatsApp</span>
          <span className="block text-muted-foreground">
            {agency} tells you on WhatsApp when something needs you — approve straight from the message. Reply STOP any time.
          </span>
        </label>
      </CardContent>
    </Card>
  );
}

/**
 * The client portal (P3-01 to P3-05): opened from a contact's private link, in the agency's name and colour. The client
 * picks topics, approves scripts and videos (or asks for changes, with comments at a moment in the video), sees their
 * invoices, and asks the team things.
 */
export function ClientPortal({ token }: { token: string }) {
  const qc = useQueryClient();
  const home = usePortal<PortalHome>(token, "");
  const [tab, setTab] = useState<Tab>("home");
  const refresh = () => qc.invalidateQueries({ queryKey: ["portal", token] });
  // The agency's name in the browser tab: the portal is theirs (P6-07).
  const agencyName = home.data?.agency.name;
  useEffect(() => {
    if (agencyName) document.title = `${agencyName} · Your portal`;
  }, [agencyName]);

  if (home.isPending)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <SkeletonRows rows={6} />
      </div>
    );
  if (home.error) {
    const gone = home.error instanceof ApiError && home.error.status === 404;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <LinkIcon className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-subheading font-semibold">{gone ? "This link does not work any more" : "Something went wrong"}</h1>
          <p className="mt-2 text-body text-muted-foreground">
            {gone ? "It may have been replaced by a newer link. Ask your agency to send it again." : errorMessage(home.error)}
          </p>
        </div>
      </div>
    );
  }

  const h = home.data;
  const brand = h.agency.brandColor ?? "#1E3A8A";
  const todo = [
    { tab: "topics" as const, n: h.todo.topics, one: "topic to pick", many: "topics to pick", icon: ListChecks },
    { tab: "scripts" as const, n: h.todo.scripts, one: "script to approve", many: "scripts to approve", icon: FileText },
    { tab: "videos" as const, n: h.todo.videos, one: "video to review", many: "videos to review", icon: Film },
    { tab: "invoices" as const, n: h.todo.invoices, one: "invoice to pay", many: "invoices to pay", icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card print:hidden" style={{ borderTop: `4px solid ${brand}` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {h.agency.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
            <img src={h.agency.logo} alt="" className="size-10 rounded-lg object-contain" />
          ) : (
            <span className="inline-flex size-10 items-center justify-center rounded-lg text-subheading font-bold text-white" style={{ background: brand }}>
              {h.agency.name[0]}
            </span>
          )}
          <div className="min-w-0">
            <div className="text-body text-muted-foreground">{h.agency.name}</div>
            <h1 className="truncate text-subheading font-semibold">{h.client.name}</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-4 w-full overflow-x-auto print:hidden">
            <TabsTrigger value="home">To do</TabsTrigger>
            <TabsTrigger value="topics">Topics</TabsTrigger>
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="ask">Ask us</TabsTrigger>
          </TabsList>
          <TabsContent value="home">
            <p className="mb-4 text-body text-muted-foreground">Hello {h.contact.name}. Here is what is waiting for you.</p>
            {todo.every((x) => !x.n) ? (
              <EmptyState icon={CheckCircle2} title="Nothing waiting" description="You are all caught up. The team will send what needs you here." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {todo
                  .filter((x) => x.n)
                  .map((x) => (
                    <button key={x.tab} type="button" onClick={() => setTab(x.tab)} className="text-left">
                      <Card className="transition-colors hover:border-secondary/40">
                        <CardContent className="flex items-center gap-3 p-4">
                          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                            <x.icon className="size-4" />
                          </span>
                          <span className="font-medium">
                            {x.n} {x.n === 1 ? x.one : x.many}
                          </span>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
              </div>
            )}
            {h.whatsapp.available && <WhatsAppChoice token={token} on={h.whatsapp.optIn} agency={h.agency.name} onChange={refresh} />}
          </TabsContent>
          <TabsContent value="topics">
            <Topics token={token} />
          </TabsContent>
          <TabsContent value="scripts">
            <Scripts token={token} refresh={refresh} />
          </TabsContent>
          <TabsContent value="videos">
            <Videos token={token} refresh={refresh} />
          </TabsContent>
          <TabsContent value="invoices">
            <Invoices token={token} />
          </TabsContent>
          <TabsContent value="reports">
            <Reports token={token} />
          </TabsContent>
          <TabsContent value="ask">
            <Ask token={token} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
