"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, CircleCheck, ClipboardList, Mail, MessageCircle, NotebookText, PencilLine, Presentation, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppPreview } from "@/components/shared/whatsapp-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useDemo } from "@/lib/store";
import { cn, fmtDate } from "@/lib/utils";
import { AREA_TONE, type Insight, type InsightDraft } from "./data";
import { useGenie } from "./store";

const KIND_ICON: Record<InsightDraft["kind"], typeof Mail> = {
  WhatsApp: MessageCircle,
  Email: Mail,
  Task: ClipboardList,
  Report: NotebookText,
  "Agenda item": Presentation,
};

const kindLabel = (k: InsightDraft["kind"]) => (k === "WhatsApp" ? "WhatsApp message" : k.toLowerCase());

const SEV = {
  high: "bg-danger",
  medium: "bg-warning",
  low: "bg-info",
} as const;

export function InsightCard({ insight, compact }: { insight: Insight; compact?: boolean }) {
  const status = useGenie((s) => s.status[insight.id]);
  const edited = useGenie((s) => s.edits[insight.id]);
  const setStatus = useGenie((s) => s.setStatus);
  const edit = useGenie((s) => s.edit);
  const log = useDemo((s) => s.log);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(edited ?? insight.draft?.text ?? "");
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("already");
  const draftText = edited ?? insight.draft?.text;

  const approve = () => {
    setStatus(insight.id, "approved");
    log(`Genie Assistant: ${insight.doneLabel.toLowerCase()} — approved by Janarthanan`, "success");
    toast.success(insight.doneLabel, { description: edited ? "Sent with your edits. Logged in the audit trail." : "Approved by you. Logged in the audit trail." });
  };

  if (status) {
    return (
      <Card className={cn("flex items-center gap-3 p-3.5", compact && "shadow-none")}>
        <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", status === "approved" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
          {status === "approved" ? <CircleCheck className="size-4" /> : <X className="size-4" />}
        </span>
        <div className="min-w-0 flex-1 text-body">
          <div className={cn("truncate font-medium", status === "dismissed" && "text-muted-foreground line-through")}>{insight.title}</div>
          <div className="text-muted-foreground">{status === "approved" ? `${insight.doneLabel}${edited ? " · edited" : ""}` : "Dismissed · noted for rule tuning"}</div>
        </div>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            useGenie.setState((s) => {
              const next = { ...s.status };
              delete next[insight.id];
              return { status: next };
            });
          }}
        >
          <Undo2 /> Undo
        </Button>
      </Card>
    );
  }

  const KindIcon = insight.draft ? KIND_ICON[insight.draft.kind] : ClipboardList;

  return (
    <Card className={cn("overflow-hidden", compact && "shadow-none")}>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-body text-muted-foreground">
          <span className={cn("size-2 rounded-full", SEV[insight.severity])} aria-hidden />
          <Badge tone={AREA_TONE[insight.area]}>{insight.area}</Badge>
          {insight.draft && compact && <Badge tone="outline">Draft {kindLabel(insight.draft.kind)} ready</Badge>}
          {!compact && (
            <>
              <span>Rule: {insight.rule}</span>
              <span className="ml-auto">{fmtDate(insight.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </>
          )}
        </div>
        <div className="mt-2 text-body font-semibold text-text-primary">{insight.title}</div>
        {!compact && (
          <ul className="mt-1.5 space-y-0.5 text-body text-muted-foreground">
            {insight.evidence.map((e) => (
              <li key={e} className="flex items-start gap-1.5">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" /> {e}
              </li>
            ))}
          </ul>
        )}
        {insight.draft && !compact && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-body">
              <KindIcon className="size-4 text-primary" />
              <span className="font-medium">Draft {kindLabel(insight.draft.kind)}</span>
              {insight.draft.to && <span className="text-muted-foreground">to {insight.draft.to}</span>}
              {edited && <Badge tone="info">Edited</Badge>}
            </div>
            {insight.draft.kind === "WhatsApp" ? (
              <WhatsAppPreview className="max-w-md" messages={[{ text: draftText!, time: "Draft", buttons: insight.draft.buttons }]} />
            ) : (
              <div className="rounded-xl border border-border bg-surface-secondary p-3 text-body">
                {insight.draft.subject && <div className="mb-1 font-semibold">{insight.draft.subject}</div>}
                <p className="whitespace-pre-line text-text-secondary">{draftText}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-surface-secondary px-4 py-2.5">
        {compact ? (
          <Link href="/genie" className="inline-flex items-center gap-1 rounded-sm text-body text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            See draft <ArrowUpRight className="size-3.5" />
          </Link>
        ) : (
          <Link href={insight.source.href} className="inline-flex items-center gap-1 rounded-sm text-body text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            Source: {insight.source.label} <ArrowUpRight className="size-3.5" />
          </Link>
        )}
        <div className="flex flex-wrap gap-1.5">
          {!compact && (
            <Button size="xs" variant="ghost" onClick={() => setDismissing(true)}>
              <X /> Dismiss
            </Button>
          )}
          {insight.draft && !compact && (
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
              <PencilLine /> Edit
            </Button>
          )}
          <Button size="xs" onClick={approve}>
            <Check /> {insight.approveLabel}
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit draft</DialogTitle>
            <DialogDescription>
              {insight.draft?.kind} {insight.draft?.to ? `to ${insight.draft.to}` : ""}. Your edit is kept with the original in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Message">
              <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-44" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                edit(insight.id, text);
                setEditing(false);
                toast("Draft updated", { description: "Review it once more, then approve." });
              }}
            >
              Save edit
            </Button>
            <Button
              onClick={() => {
                edit(insight.id, text);
                setEditing(false);
                approve();
              }}
            >
              <Check /> Save and {insight.approveLabel.toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dismissing} onOpenChange={setDismissing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss this insight</DialogTitle>
            <DialogDescription>The reason helps tune the rule so it stops flagging things you don&apos;t need.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Reason">
              <Select
                value={reason}
                onValueChange={setReason}
                options={[
                  { value: "already", label: "Already handled" },
                  { value: "irrelevant", label: "Not relevant for us" },
                  { value: "wrong", label: "The data is wrong" },
                  { value: "later", label: "Remind me next week" },
                ]}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDismissing(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setStatus(insight.id, "dismissed");
                setDismissing(false);
                toast("Dismissed", { description: "Noted for rule tuning. Nothing was sent." });
              }}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
