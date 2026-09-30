"use client";

import { useState } from "react";
import { Check, ChevronDown, FileText, ListChecks, MessageSquareWarning, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PORTAL_CLIENT_ID } from "@/lib/mock/portal";
import { cn, fmtDate } from "@/lib/utils";
import { useContent } from "@/features/content/store";
import type { ContentItem } from "@/features/content/data";

/** Client Hub: pick next month's topics and approve scripts — before anything is shot. */
export function PortalContent() {
  const items = useContent((s) => s.items);
  const lists = useContent((s) => s.lists);
  const list = lists.find((l) => l.clientId === PORTAL_CLIENT_ID && l.status === "sent");
  const scripts = items.filter((i) => i.clientId === PORTAL_CLIENT_ID && i.stage === "approval");
  if (!list && !scripts.length) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-subheading font-semibold tracking-tight">Plan with us</h2>
        <span className="text-body text-muted-foreground">Topics and scripts are agreed before anything is shot</span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {list && <TopicPicker listId={list.id} />}
        {scripts.length > 0 && <Scripts items={scripts} />}
      </div>
    </section>
  );
}

function TopicPicker({ listId }: { listId: string }) {
  const list = useContent((s) => s.lists.find((l) => l.id === listId))!;
  const items = useContent((s) => s.items);
  const setPick = useContent((s) => s.setPick);
  const confirmList = useContent((s) => s.confirmList);
  const topics = items.filter((i) => i.clientId === list.clientId && i.month === list.month && i.stage === "topic");
  const picked = topics.filter((i) => i.pick === "picked").length;
  const full = picked >= list.needed;

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" /> Choose your {list.month.split(" ")[0]} topics
          </CardTitle>
          <CardDescription>
            Pick {list.needed} of {topics.length} ideas our team prepared for you. Sent {fmtDate(list.sentOn!)}.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-body">
            <span className="font-medium">Your picks</span>
            <span className="tabular text-muted-foreground">
              {picked} of {list.needed}
            </span>
          </div>
          <Progress className="mt-1.5" value={(picked / list.needed) * 100} tone={full ? "success" : "accent"} />
        </div>
        <ul className="scrollbar-thin max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {topics.map((t) => {
            const on = t.pick === "picked";
            return (
              <li key={t.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => setPick(t.id, on ? "skipped" : "picked")}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                    on ? "border-success/40 bg-success-soft/50" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-md border", on ? "border-success bg-success text-success-foreground" : "border-border-strong")}>
                    {on && <Check className="size-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium">{t.title}</span>
                    <span className="block text-body text-muted-foreground">
                      {t.format} · {t.pillar}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <span className="text-body text-muted-foreground">{full ? "All set — send your choices." : `${list.needed - picked} more to pick`}</span>
          <Button
            size="sm"
            disabled={!full}
            onClick={() => {
              confirmList(list.id);
              toast.success("Thank you — topics confirmed", { description: "Research starts today. You'll get each script to approve before the shoot." });
            }}
          >
            <Check /> Confirm my topics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Scripts({ items }: { items: ContentItem[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Scripts to approve
          </CardTitle>
          <CardDescription>Read the script, then approve it or tell us what to change.</CardDescription>
        </div>
        <Badge tone="warning">{items.length} waiting</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((i) => (
          <ScriptRow key={i.id} item={i} />
        ))}
      </CardContent>
    </Card>
  );
}

function ScriptRow({ item }: { item: ContentItem }) {
  const decide = useContent((s) => s.decide);
  const [open, setOpen] = useState(item.stage === "approval");
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");
  const v = item.versions.at(-1)!;
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
      >
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">{item.title}</div>
          <div className="text-body text-muted-foreground">
            {item.format} · {v.label} · sent {fmtDate(item.sentOn!)}
          </div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border-subtle p-3">
          <div className="rounded-lg bg-surface-secondary p-3 text-body">
            <p className="font-semibold">{v.hook}</p>
            <p className="mt-1.5 whitespace-pre-line text-text-secondary">{v.body}</p>
            <p className="mt-1.5 text-text-secondary">
              <span className="font-medium text-text-primary">Ends with:</span> {v.cta}
            </p>
            {v.onScreen && <p className="mt-1.5 font-mono text-muted-foreground">On screen: {v.onScreen}</p>}
          </div>
          {changing ? (
            <div className="space-y-2">
              <Field label="What should we change?" required>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please mention our new 1-litre tin" autoFocus />
              </Field>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setChanging(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!note.trim()}
                  onClick={() => {
                    decide(item.id, false, note.trim());
                    toast.success("Feedback sent", { description: "The writer will share a new version, usually within a day." });
                  }}
                >
                  Send feedback
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setChanging(true)}>
                <MessageSquareWarning /> Request changes
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() => {
                  decide(item.id, true);
                  toast.success("Script approved", { description: "We'll schedule the shoot and confirm the date on WhatsApp." });
                }}
              >
                <ThumbsUp /> Approve script
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
