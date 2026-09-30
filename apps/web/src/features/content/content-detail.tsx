"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Clapperboard, ExternalLink, History, Link2, MessageSquareWarning, Plus, Save, SearchX, Send, Sparkles, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { WhatsAppSendDialog } from "@/components/shared/whatsapp-send-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { clientById, personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, fmtDate } from "@/lib/utils";
import { greet, waitingDays } from "./content-hub";
import { CONTENT_STAGES, type ContentItem, type ScriptVersion } from "./data";
import { useContent } from "./store";

type Draft = Pick<ScriptVersion, "hook" | "body" | "cta" | "onScreen">;
const blank: Draft = { hook: "", body: "", cta: "", onScreen: "" };

export function ContentDetail({ id }: { id: string }) {
  const item = useContent((s) => s.items.find((i) => i.id === id));
  if (!item) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={SearchX}
          title="Content item not found"
          description="It may have been removed after a demo reset."
          action={
            <Button asChild variant="secondary">
              <Link href="/content">
                <ArrowLeft /> Content
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }
  return <Workspace item={item} />;
}

function Workspace({ item }: { item: ContentItem }) {
  const c = clientById(item.clientId);
  const owner = personById(item.ownerId);
  const stageIdx = CONTENT_STAGES.findIndex((s) => s.id === item.stage);

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/content" className="inline-flex items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            <ArrowLeft className="size-3.5" /> Content
          </Link>
        }
        title={item.title}
        description={
          <>
            {c.name} · {item.pillar} · {item.format} · {item.month} · owner {owner.name} · due {fmtDate(item.due)}
            {item.source === "Genie Assistant" && " · idea suggested by Genie Assistant"}
          </>
        }
      />

      <ol className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Content stages">
        {CONTENT_STAGES.map((s, i) => (
          <li
            key={s.id}
            aria-current={i === stageIdx ? "step" : undefined}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-body",
              i < stageIdx && "border-success/30 bg-success-soft/50 text-success",
              i === stageIdx && "border-primary bg-primary-soft/60 font-semibold text-primary",
              i > stageIdx && "border-border bg-card text-muted-foreground",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {i < stageIdx && <Check className="size-3.5" />}
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] [&>*]:min-w-0">
        <Research item={item} />
        <ScriptPanel item={item} />
      </div>
    </div>
  );
}

function Research({ item }: { item: ContentItem }) {
  const setNotes = useContent((s) => s.setNotes);
  const addLink = useContent((s) => s.addLink);
  const move = useContent((s) => s.move);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const urlOk = /^https?:\/\/\S+\.\S+/.test(url);

  return (
    <div className="space-y-4">
      <SectionCard title="Brief and research" description="Facts, angles and claims to check before writing. Saved automatically.">
        <div className="space-y-4">
          <Field label="Research notes">
            <Textarea value={item.notes} onChange={(e) => setNotes(item.id, e.target.value)} className="min-h-40" placeholder="Key facts, the angle, words to avoid, who is on camera…" />
          </Field>
          <div className="space-y-2">
            <div className="text-body font-medium text-text-secondary">References</div>
            {item.links.map((l) => (
              <a
                key={l.url + l.label}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-body hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{l.label}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input aria-label="Reference name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. Brand guide" />
              <Input aria-label="Reference link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              <Button
                variant="outline"
                size="default"
                disabled={!label.trim() || !urlOk}
                onClick={() => {
                  addLink(item.id, { label: label.trim(), url });
                  setLabel("");
                  setUrl("");
                }}
              >
                <Plus /> Add
              </Button>
            </div>
          </div>
          {(item.stage === "idea" || item.stage === "topic" || item.stage === "research") && (
            <Button
              variant="soft"
              size="sm"
              onClick={() => {
                move(item.id, "script");
                toast.success("Research done — start the script");
              }}
            >
              <Check /> Research done
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function ScriptPanel({ item }: { item: ContentItem }) {
  const router = useRouter();
  const saveDraft = useContent((s) => s.saveDraft);
  const sendScript = useContent((s) => s.sendScript);
  const decide = useContent((s) => s.decide);
  const videos = useDemo((s) => s.videos);
  const c = clientById(item.clientId);
  const approver = c.contacts.find((x) => x.approver) ?? c.contacts[0]!;
  const last = item.versions.at(-1);
  const editable = !last || last.status === "draft" || last.status === "changes";
  const [draft, setDraft] = useState<Draft>(last && last.status === "draft" ? pick(last) : last ? pick(last) : blank);
  const [viewing, setViewing] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [changes, setChanges] = useState(false);
  const [note, setNote] = useState("");
  const shown = viewing ? item.versions.find((v) => v.id === viewing) : undefined;
  const complete = draft.hook.trim() && draft.body.trim() && draft.cta.trim();
  const video = item.videoCode ? videos.find((v) => v.code === item.videoCode) : undefined;
  const wait = waitingDays(item.sentOn);

  const approve = () => {
    const code = decide(item.id, true);
    toast.success(`Script approved by ${greet(approver.name)}`, {
      description: `In Video Production as ${code}. Confirmation sent on WhatsApp.`,
      action: { label: "Open video", onClick: () => router.push("/production") },
    });
  };

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Script
            {last && <Badge tone={last.status === "approved" ? "success" : last.status === "sent" ? "info" : last.status === "changes" ? "warning" : "neutral"}>{statusLabel(last)}</Badge>}
          </CardTitle>
          <CardDescription>Hook, body, call to action and on-screen text. Every send to the client is a new version.</CardDescription>
        </div>
        {item.versions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Versions">
            <History className="mr-1 size-3.5 text-muted-foreground" />
            {item.versions.map((v) => (
              <Button key={v.id} size="xs" variant={(viewing ?? last?.id) === v.id ? "default" : "ghost"} onClick={() => setViewing(v.id === last?.id ? null : v.id)}>
                {v.label}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {item.stage === "approval" && last?.status === "sent" && (
          <div className={cn("flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center", wait >= 2 ? "border-warning/30 bg-warning-soft/40" : "border-info/25 bg-info-soft/60")}>
            <div className="min-w-0 flex-1 text-body">
              <div className="font-semibold">
                With {approver.name} for approval · {wait === 0 ? "sent today" : `waiting ${wait} day${wait === 1 ? "" : "s"}`}
              </div>
              <div className="text-muted-foreground">They can approve in the Client Hub or tap a button in the WhatsApp message. Record their reply here if it came by phone.</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" onClick={() => setChanges(true)}>
                <MessageSquareWarning /> Changes
              </Button>
              <Button size="sm" variant="success" onClick={approve}>
                <ThumbsUp /> Approved
              </Button>
            </div>
          </div>
        )}
        {item.stage === "ready" && (
          <div className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft/50 p-3.5 sm:flex-row sm:items-center">
            <Clapperboard className="size-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1 text-body">
              <div className="font-semibold">Approved — in Video Production as {item.videoCode}</div>
              <div className="text-muted-foreground">{video ? `Stage: ${video.stage} · editor ${personById(video.editorId).name}` : "Scheduled for the next shoot."}</div>
            </div>
            {video && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/production/${video.id}`}>Open video</Link>
              </Button>
            )}
          </div>
        )}
        {last?.status === "changes" && last.clientNote && !shown && (
          <div className="rounded-xl border border-warning/30 bg-warning-soft/40 p-3.5 text-body">
            <div className="font-semibold">
              {greet(approver.name)} asked for changes on {last.label}
            </div>
            <div className="text-text-secondary">“{last.clientNote}”</div>
          </div>
        )}

        {shown ? (
          <ReadOnly v={shown} onBack={() => setViewing(null)} />
        ) : editable ? (
          <div className="space-y-4">
            <Field label="Hook (first 3 seconds)" required>
              <Input value={draft.hook} onChange={(e) => setDraft({ ...draft, hook: e.target.value })} placeholder="The line that stops the scroll" />
            </Field>
            <Field label="Body / scenes" required>
              <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-36" placeholder="One line per scene or beat" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Call to action" required>
                <Input value={draft.cta} onChange={(e) => setDraft({ ...draft, cta: e.target.value })} />
              </Field>
              <Field label="On-screen text">
                <Input value={draft.onScreen} onChange={(e) => setDraft({ ...draft, onScreen: e.target.value })} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4">
              <span className="text-body text-muted-foreground">
                {last?.status === "draft" ? `Editing ${last.label} draft · last saved ${fmtDate(last.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} by ${last.by}` : `Saving creates v${item.versions.length + 1}`}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!complete}
                  onClick={() => {
                    saveDraft(item.id, draft, "Karthik Subramanian");
                    toast.success("Draft saved");
                  }}
                >
                  <Save /> Save draft
                </Button>
                <Button
                  size="sm"
                  disabled={!complete}
                  onClick={() => {
                    saveDraft(item.id, draft, "Karthik Subramanian");
                    setSending(true);
                  }}
                >
                  <Send /> Send to client
                </Button>
              </div>
            </div>
          </div>
        ) : (
          last && <ReadOnly v={last} />
        )}
      </CardContent>

      <WhatsAppSendDialog
        open={sending}
        onOpenChange={setSending}
        title="Send script for approval"
        description={`${approver.name} can approve in the Client Hub or reply with a button.`}
        to={{ name: approver.name, phone: approver.phone }}
        templateId="approval_request"
        vars={{ name: greet(approver.name), item: "script", title: item.title }}
        onSend={() => {
          sendScript(item.id);
          toast.success("Script sent for approval", { description: "Genie Assistant reminds the client after 2 days without a reply." });
        }}
      />
      <Dialog open={changes} onOpenChange={setChanges}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client asked for changes</DialogTitle>
            <DialogDescription>Record what {greet(approver.name)} said. The script goes back to the writer as a new version.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Client's feedback" required>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Use the new pack design; mention the festive offer" autoFocus />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChanges(false)}>
              Cancel
            </Button>
            <Button
              disabled={!note.trim()}
              onClick={() => {
                decide(item.id, false, note.trim());
                setDraft(last ? pick(last) : blank);
                setNote("");
                setChanges(false);
                toast("Changes recorded", { description: `${personById(item.ownerId).name} has been notified.` });
              }}
            >
              Save feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function pick(v: ScriptVersion): Draft {
  return { hook: v.hook, body: v.body, cta: v.cta, onScreen: v.onScreen };
}

function statusLabel(v: ScriptVersion) {
  return { draft: `${v.label} draft`, sent: `${v.label} with client`, changes: `${v.label} · changes requested`, approved: `${v.label} approved` }[v.status];
}

function ReadOnly({ v, onBack }: { v: ScriptVersion; onBack?: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-body text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={v.by} size="xs" /> {v.label} by {v.by} · {fmtDate(v.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
        </span>
        {onBack && (
          <Button size="xs" variant="ghost" onClick={onBack}>
            Back to latest
          </Button>
        )}
      </div>
      <div className="rounded-xl border border-border bg-surface-secondary p-4">
        <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Hook</div>
        <p className="mt-0.5 text-subheading font-semibold">{v.hook}</p>
        <div className="mt-3 text-body font-medium uppercase tracking-wider text-muted-foreground">Body</div>
        <p className="mt-0.5 whitespace-pre-line text-body">{v.body}</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">Call to action</div>
            <p className="mt-0.5 text-body">{v.cta}</p>
          </div>
          <div>
            <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">On-screen text</div>
            <p className="mt-0.5 font-mono text-body">{v.onScreen || "—"}</p>
          </div>
        </div>
      </div>
      {v.clientNote && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft/40 p-3 text-body">
          <span className="font-semibold">Client feedback:</span> “{v.clientNote}”
        </div>
      )}
      {v.status === "approved" && (
        <Badge tone="success">
          <Sparkles /> Approved by the client
        </Badge>
      )}
    </div>
  );
}
