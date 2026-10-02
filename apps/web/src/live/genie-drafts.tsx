"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, MessageCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { type CaptionDraft, DRAFT_KIND_LABEL, type DraftOutput, type DraftRequest, type DraftRow, type IdeasDraft } from "@gm/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ApiError, errorMessage } from "./api";
import { useCreateDraft, useDecideDraft } from "./queries";

const APPROVE: Record<DraftRow["kind"], string> = {
  nudge: "Approve and open WhatsApp",
  caption: "Approve — use on the posts",
  ideas: "Add the ticked ideas",
  report_summary: "Use as the report's note",
};

/** Ideas as the person ticks the ones to keep. */
type Kept = { ideas: (IdeasDraft["ideas"][number] & { keep: boolean })[] };
const editable = (d: DraftRow): DraftOutput =>
  d.kind === "ideas" ? ({ ideas: (d.output as IdeasDraft).ideas.map((i) => ({ ...i, keep: true })) } as Kept) : d.output;
const finalOf = (d: DraftRow, v: DraftOutput) =>
  d.kind === "ideas"
    ? { ideas: (v as Kept).ideas.filter((i) => i.keep).map((i) => ({ title: i.title, pillar: i.pillar, format: i.format, why: i.why })) }
    : (v as Record<string, unknown>);

/** The draft as the person edits it. */
function Editor({ d, value, onChange, errors }: { d: DraftRow; value: DraftOutput; onChange: (v: DraftOutput) => void; errors: Record<string, string> }) {
  switch (d.kind) {
    case "nudge": {
      const v = value as { message: string };
      return (
        <Field label="Message" error={errors.message}>
          <Textarea rows={5} value={v.message} onChange={(e) => onChange({ message: e.target.value })} />
        </Field>
      );
    }
    case "report_summary": {
      const v = value as { note: string };
      return (
        <Field label="The report's note" error={errors.note}>
          <Textarea rows={7} value={v.note} onChange={(e) => onChange({ note: e.target.value })} />
        </Field>
      );
    }
    case "caption": {
      const v = value as CaptionDraft;
      return (
        <div className="space-y-3">
          <Field label="Caption" error={errors.caption}>
            <Textarea rows={7} value={v.caption} onChange={(e) => onChange({ ...v, caption: e.target.value })} />
          </Field>
          <Field label="Hashtags" hint="Separated by spaces" error={Object.entries(errors).find(([k]) => k.startsWith("hashtags"))?.[1]}>
            <Input value={v.hashtags.join(" ")} onChange={(e) => onChange({ ...v, hashtags: e.target.value.split(/\s+/).filter(Boolean) })} />
          </Field>
          <Field label="Thumbnail text" error={errors.thumbnailText}>
            <Input value={v.thumbnailText} onChange={(e) => onChange({ ...v, thumbnailText: e.target.value })} />
          </Field>
        </div>
      );
    }
    case "ideas": {
      const v = value as Kept;
      return (
        <ul className="space-y-2">
          {v.ideas.map((idea, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-border p-3">
              <Checkbox
                checked={idea.keep}
                aria-label={`Keep idea ${i + 1}`}
                onCheckedChange={(c) => onChange({ ideas: v.ideas.map((x, j) => (j === i ? { ...x, keep: c === true } : x)) } as Kept)}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  value={idea.title}
                  disabled={!idea.keep}
                  onChange={(e) => onChange({ ideas: v.ideas.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) } as Kept)}
                />
                <p className="text-body text-muted-foreground">
                  {idea.pillar} · {idea.format} — {idea.why}
                </p>
              </div>
            </li>
          ))}
        </ul>
      );
    }
  }
}

/**
 * Asks Genie Assistant for a draft and lets the person edit it, approve it (which puts it to use) or reject it
 * (P4-06). Nothing is sent or changed until they approve.
 */
export function DraftDialog({
  request,
  title,
  description,
  onClose,
  onApproved,
}: {
  request: DraftRequest;
  title: string;
  description?: string;
  onClose: () => void;
  onApproved?: () => void;
}) {
  const create = useCreateDraft();
  const decide = useDecideDraft();
  const [d, setD] = useState<DraftRow | null>(null);
  const [value, setValue] = useState<DraftOutput | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const started = useRef(false);

  const write = () =>
    create.mutate(request, {
      onSuccess: (r) => {
        setD(r);
        setValue(editable(r));
        setErrors({});
      },
    });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    write();
    // Asks once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const again = () => {
    if (d) decide.mutate({ id: d.id, status: "rejected" });
    setD(null);
    write();
  };
  const approve = () =>
    decide.mutate(
      { id: d!.id, status: "approved", final: finalOf(d!, value!) },
      {
        onSuccess: (r) => {
          if (r.whatsappLink) window.open(r.whatsappLink, "_blank", "noopener");
          toast.success(r.postsUpdated ? `Approved — on ${r.postsUpdated === 1 ? "1 post" : `${r.postsUpdated} posts`}` : "Approved");
          onApproved?.();
          onClose();
        },
        onError: (e) =>
          e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e)),
      },
    );
  const reject = () =>
    decide.mutate({ id: d!.id, status: "rejected" }, { onSuccess: () => (toast.success("Rejected"), onClose()), onError: (e) => toast.error(errorMessage(e)) });

  const switchedOff = create.error instanceof ApiError && /Settings → Genie Assistant/.test(create.error.message);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description ??
              `A ${DRAFT_KIND_LABEL[request.kind].toLowerCase()} for you to check, edit and approve. Nothing is sent or changed until you approve it.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {create.isPending ? (
            <div className="space-y-2">
              <p className="text-body text-muted-foreground">Genie Assistant is writing…</p>
              <SkeletonRows rows={3} />
            </div>
          ) : create.error ? (
            <Alert tone="warning">
              {errorMessage(create.error)}
              {switchedOff && (
                <>
                  {" "}
                  <Link href="/app/settings/genie" className="underline">
                    Open the settings
                  </Link>
                </>
              )}
            </Alert>
          ) : d && value ? (
            <div className="space-y-3">
              {d.source === "stand-in" && (
                <Alert tone="info">On this server the model is not switched on, so this draft is made up by a stand-in — the steps are real.</Alert>
              )}
              <Editor d={d} value={value} onChange={setValue} errors={errors} />
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          {d && (
            <>
              <Button variant="ghost" disabled={decide.isPending || create.isPending} onClick={again}>
                <RefreshCw />
                Write it again
              </Button>
              <Button variant="ghost" disabled={decide.isPending} onClick={reject}>
                <X />
                Reject
              </Button>
              <Button disabled={decide.isPending} onClick={approve}>
                {d.kind === "nudge" ? <MessageCircle /> : <Check />}
                {APPROVE[d.kind]}
              </Button>
            </>
          )}
          {!d && (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
