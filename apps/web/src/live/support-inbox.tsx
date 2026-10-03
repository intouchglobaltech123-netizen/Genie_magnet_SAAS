"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL, type TicketCategory, type TicketDetail, type TicketRow, type TicketStatus, ticketInput } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { HELP } from "./help-articles";
import { useTicket, useTicketAction, useTickets } from "./queries";

export const when = (at: string) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  open: { label: "Waiting for support", tone: "warning" },
  answered: { label: "Support replied", tone: "info" },
  closed: { label: "Closed", tone: "neutral" },
};

/** A conversation, oldest first: the support team's messages on the other side. */
export function Thread({ t, supportSide }: { t: TicketDetail; supportSide?: boolean }) {
  return (
    <ol className="space-y-3">
      {t.messages.map((m) => {
        const mine = supportSide ? m.fromSupport : !m.fromSupport;
        return (
          <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-xl border p-3 text-body", mine ? "border-primary/20 bg-primary-soft" : "border-border bg-surface")}>
              <div className="mb-1 text-muted-foreground">
                {m.fromSupport ? `Support · ${m.author}` : m.author} · {when(m.createdAt)}
              </div>
              <p className="whitespace-pre-line break-words">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Messages to support (P6-15): writing a new one, and the ones written before. */
export function LiveSupport({ from, about }: { from?: string; about?: string }) {
  const q = useTickets();
  const act = useTicketAction();
  // Where it was written from: the page Help was opened on, or the guide that did not answer it.
  const guide = HELP.find((a) => a.slug === about);
  const [f, setF] = useState({ category: "question" as TicketCategory, subject: "", body: "", page: from ?? (guide ? `/app/help/${guide.slug}` : "") });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ticketInput.safeParse({ ...f, page: f.page || undefined });
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    act.mutate(
      { step: "create", body: parsed.data },
      {
        onSuccess: (t) => (setF({ ...f, subject: "", body: "" }), toast.success(`Sent. Your reference is ${t.ref}.`)),
        onError: (err) =>
          err instanceof ApiError && err.body.issues
            ? setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message])))
            : toast.error(errorMessage(err)),
      },
    );
  };
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/help">
          <ArrowLeft /> Help
        </Link>
      </Button>
      <PageHeader title="Messages to support" description="Write to the platform's support team. They answer here, and you are told when they do." />
      <SectionCard title="New message" className="mb-5">
        <form onSubmit={send} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
            <Field label="About">
              <Select
                value={f.category}
                onValueChange={(v) => setF({ ...f, category: v as TicketCategory })}
                options={TICKET_CATEGORIES.map((c) => ({ value: c, label: TICKET_CATEGORY_LABEL[c] }))}
              />
            </Field>
            <Field label="Subject" error={errors.subject}>
              <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="In a few words" maxLength={120} />
            </Field>
          </div>
          <Field label="Message" error={errors.body} hint={f.page ? `Sent from ${f.page}` : undefined}>
            <Textarea
              rows={5}
              value={f.body}
              onChange={(e) => setF({ ...f, body: e.target.value })}
              placeholder="What were you doing, and what happened? A request id from an error message helps."
            />
          </Field>
          <Button type="submit" variant="accent" disabled={act.isPending}>
            <Send /> Send
          </Button>
        </form>
      </SectionCard>
      {q.isPending ? (
        <SkeletonRows rows={3} />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : !q.data.length ? (
        <Card className="p-6">
          <EmptyState icon={MessageSquare} title="No messages yet" description="What you write to support, and their answers, are kept here." />
        </Card>
      ) : (
        <TicketList rows={q.data} href={(t) => `/app/support/${t.id}`} />
      )}
    </>
  );
}

export function TicketList({ rows, href, onPick }: { rows: TicketRow[]; href?: (t: TicketRow) => string; onPick?: (t: TicketRow) => void }) {
  return (
    <ul className="space-y-2">
      {rows.map((t) => {
        const body = (
          <Card className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:border-secondary/40">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-body font-medium">
                {t.subject}
                <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
              </div>
              <div className="text-body text-muted-foreground">
                {t.agency ? `${t.agency.name} · ` : ""}
                {TICKET_CATEGORY_LABEL[t.category]} · {t.createdBy.name} · {t.ref} · {when(t.updatedAt)}
              </div>
            </div>
          </Card>
        );
        return (
          <li key={t.id}>
            {href ? (
              <Link href={href(t)} className="block">
                {body}
              </Link>
            ) : (
              <button type="button" className="block w-full cursor-pointer text-left" onClick={() => onPick?.(t)}>
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One conversation with support. */
export function LiveSupportTicket({ id }: { id: string }) {
  const q = useTicket(id);
  const act = useTicketAction();
  const [reply, setReply] = useState("");
  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
      <Link href="/app/support">
        <ArrowLeft /> Messages to support
      </Link>
    </Button>
  );
  if (q.isPending) return <SkeletonRows rows={4} />;
  if (q.error)
    return (
      <>
        {back}
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      </>
    );
  const t = q.data;
  return (
    <>
      {back}
      <PageHeader
        title={t.subject}
        description={`${TICKET_CATEGORY_LABEL[t.category]} · reference ${t.ref}${t.page ? ` · sent from ${t.page}` : ""}`}
        actions={<Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>}
      />
      <div className="max-w-3xl space-y-5">
        <Thread t={t} />
        {t.status === "closed" ? (
          <Alert tone="info">
            This conversation is closed.{" "}
            <Link href="/app/support" className="font-medium underline underline-offset-2">
              Write a new message
            </Link>{" "}
            if there is more.
          </Alert>
        ) : (
          <Card className="space-y-3 p-4">
            <Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply" aria-label="Reply" />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="accent"
                size="sm"
                disabled={act.isPending || !reply.trim()}
                onClick={() => act.mutate({ step: "reply", id, body: reply }, { onSuccess: () => setReply(""), onError: (e) => toast.error(errorMessage(e)) })}
              >
                <Send /> Send
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={act.isPending}
                onClick={() => act.mutate({ step: "close", id }, { onSuccess: () => toast("Closed"), onError: (e) => toast.error(errorMessage(e)) })}
              >
                <Check /> It is sorted, close it
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
