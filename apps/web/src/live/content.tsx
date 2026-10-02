"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Lightbulb, MessageSquareReply, Plus, Send, ShieldCheck, Sparkles, ThumbsUp, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { type ContentItem, contentInput, scriptInput } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { NoteDialog } from "./deals";
import { fmtDate } from "./format";
import { CONTENT_STAGE_LABEL, MonthSwitcher, monthLabel, StageBadge, thisMonth } from "./production-bits";
import {
  useCan,
  useClients,
  useContent,
  useContentAction,
  useContentList,
  useCreateContent,
  useProductionSettings,
  useSavePillars,
  useTopicListAction,
  useTopicLists,
} from "./queries";

const STAGES = ["idea", "topic", "research", "script", "approval", "ready"] as const;
const SCRIPT_STATUS: Record<ContentItem["scripts"][number]["status"], { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  review: { label: "Waiting for review", tone: "warning" },
  sent: { label: "With the client", tone: "info" },
  changes: { label: "Changes asked", tone: "danger" },
  approved: { label: "Approved", tone: "success" },
};

function NewIdeaDialog({ clientId, month, open, onOpenChange }: { clientId?: string; month: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const clients = useClients();
  const settings = useProductionSettings();
  const create = useCreateContent();
  const [f, setF] = useState({ clientId: clientId ?? "", title: "", pillar: "", format: "Reel", month, notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const client = clients.data?.find((c) => c.id === f.clientId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = contentInput.safeParse({ ...f, notes: f.notes || undefined });
            if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])));
            create.mutate(parsed.data, {
              onSuccess: (c) => {
                toast.success("Idea added", { description: c.title });
                setF({ ...f, title: "", notes: "" });
                onOpenChange(false);
              },
              onError: (err) => err instanceof ApiError && err.body.issues && setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path, i.message]))),
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>New idea</DialogTitle>
            <DialogDescription>It goes into the idea bank for the month, ready for the client&apos;s topic list.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Client" required error={errors.clientId}>
              <Select
                aria-label="Client"
                value={f.clientId || undefined}
                placeholder="Choose the client"
                onValueChange={(v) => setF({ ...f, clientId: v, pillar: "" })}
                options={(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
              />
            </Field>
            <Field label="Idea" required error={errors.title}>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Millet dosa in 60 seconds" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Pillar" hint={client && !client.pillars.length ? "Set the client's pillars in the idea bank." : undefined}>
                <Select
                  aria-label="Pillar"
                  value={f.pillar || "_none"}
                  onValueChange={(v) => setF({ ...f, pillar: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "No pillar" }, ...(client?.pillars ?? []).map((p) => ({ value: p, label: p }))]}
                />
              </Field>
              <Field label="Format" required>
                <Select
                  aria-label="Format"
                  value={f.format}
                  onValueChange={(format) => setF({ ...f, format })}
                  options={(settings.data?.formats ?? [{ name: "Reel" }]).map((x) => ({ value: x.name, label: x.name }))}
                />
              </Field>
              <Field label="Month" required error={errors.month}>
                <Input type="month" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            {create.error && !(create.error instanceof ApiError && create.error.body.issues) && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              <Lightbulb />
              Add idea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContentCard({ c }: { c: ContentItem }) {
  const last = c.scripts[0];
  return (
    <Link href={`/app/content/${c.id}`} className="block rounded-lg border border-border bg-surface p-3 shadow-sm transition-colors hover:border-secondary/40">
      <div className="text-body font-medium">{c.title}</div>
      <div className="mt-0.5 text-body text-muted-foreground">
        {c.client.code} · {c.format}
        {c.pillar && ` · ${c.pillar}`}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {c.pick && <Badge tone={c.pick === "picked" ? "success" : "neutral"}>{c.pick === "picked" ? "Picked" : "Skipped"}</Badge>}
        {last && <Badge tone={SCRIPT_STATUS[last.status].tone}>{`${last.label} · ${SCRIPT_STATUS[last.status].label}`}</Badge>}
        {c.video && <Badge tone="outline">{c.video.code}</Badge>}
      </div>
    </Link>
  );
}

function Board({ items }: { items: ContentItem[] }) {
  return (
    <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {STAGES.map((s) => {
        const list = items.filter((i) => i.stage === s);
        return (
          <section
            key={s}
            aria-label={CONTENT_STAGE_LABEL[s]}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-border-subtle bg-surface-secondary p-2"
          >
            <header className="mb-2 flex items-center justify-between px-1">
              <span className="text-body font-semibold">{CONTENT_STAGE_LABEL[s]}</span>
              <Badge tone="outline">{list.length}</Badge>
            </header>
            <div className="space-y-2">
              {list.map((c) => (
                <ContentCard key={c.id} c={c} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TopicLists({ month, clientId }: { month: string; clientId: string }) {
  const can = useCan();
  const lists = useTopicLists(month);
  const clients = useClients();
  const step = useTopicListAction();
  const [newList, setNewList] = useState({ clientId: "", needed: "8" });
  const shown = (lists.data ?? []).filter((l) => !clientId || l.client.id === clientId);
  const run = (v: Parameters<typeof step.mutate>[0], done: string) =>
    step.mutate(v, { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <div className="space-y-4">
      {can("content", "edit") && (
        <Card className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Start a topic list for" className="min-w-56 flex-1">
            <Select
              aria-label="Client"
              value={newList.clientId || undefined}
              placeholder="Choose the client"
              onValueChange={(v) => setNewList({ ...newList, clientId: v })}
              options={(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Topics needed">
            <Input type="number" min={1} className="w-28" value={newList.needed} onChange={(e) => setNewList({ ...newList, needed: e.target.value })} />
          </Field>
          <Button
            disabled={!newList.clientId}
            onClick={() => run({ step: "save", clientId: newList.clientId, month, needed: Number(newList.needed) || 1 }, "Topic list ready")}
          >
            <Plus />
            Start
          </Button>
        </Card>
      )}
      {lists.isPending ? (
        <SkeletonRows rows={3} />
      ) : !shown.length ? (
        <EmptyState
          icon={Sparkles}
          title={`No topic lists for ${monthLabel(month)}`}
          description="Start one for a client: their month's ideas are offered to them to pick from."
        />
      ) : (
        shown.map((l) => (
          <SectionCard
            key={l.id}
            title={l.client.name}
            description={`${l.picked} of ${l.needed} picked · ${l.status === "draft" ? "not sent yet" : l.status === "sent" ? `sent ${l.sentAt ? fmtDate(l.sentAt) : ""}` : "confirmed"}`}
            actions={
              can("content", "edit") &&
              (l.status === "draft" ? (
                <Button size="sm" onClick={() => run({ step: "send", id: l.id }, "Sent — the client picks from these topics")}>
                  <Send />
                  Send to the client
                </Button>
              ) : l.status === "sent" ? (
                <Button size="sm" onClick={() => run({ step: "confirm", id: l.id }, "Confirmed — picked topics go to research")}>
                  <Check />
                  Confirm the picks
                </Button>
              ) : null)
            }
          >
            {!l.items.length ? (
              <p className="text-body text-muted-foreground">No ideas for this month yet — add them to the idea bank.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {l.items.map((c) => (
                  <PickRow key={c.id} c={c} canPick={l.status === "sent" && can("content", "edit")} />
                ))}
              </ul>
            )}
          </SectionCard>
        ))
      )}
    </div>
  );
}

function PickRow({ c, canPick }: { c: ContentItem; canPick: boolean }) {
  const act = useContentAction(c.id);
  const set = (pick: "picked" | "skipped" | null) =>
    act.mutate({ path: "/pick", method: "PUT", body: { pick } }, { onError: (e) => toast.error(errorMessage(e)) });
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <Link href={`/app/content/${c.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate text-body font-medium">{c.title}</span>
        <span className="text-body text-muted-foreground">
          {c.format}
          {c.pillar && ` · ${c.pillar}`}
        </span>
      </Link>
      {canPick ? (
        <span className="flex gap-1.5">
          <Button size="xs" variant={c.pick === "picked" ? "success" : "secondary"} onClick={() => set(c.pick === "picked" ? null : "picked")}>
            <Check />
            Picked
          </Button>
          <Button size="xs" variant={c.pick === "skipped" ? "default" : "ghost"} onClick={() => set(c.pick === "skipped" ? null : "skipped")}>
            <X />
            Skip
          </Button>
        </span>
      ) : (
        <Badge tone={c.stage === "idea" ? "neutral" : "info"}>{CONTENT_STAGE_LABEL[c.stage]}</Badge>
      )}
    </li>
  );
}

function PillarsEditor({ clientId, pillars }: { clientId: string; pillars: string[] }) {
  const save = useSavePillars(clientId);
  const [list, setList] = useState(pillars);
  const [next, setNext] = useState("");
  const dirty = JSON.stringify(list) !== JSON.stringify(pillars);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {list.map((p) => (
          <Badge key={p} tone="accent" className="gap-1">
            {p}
            <button type="button" aria-label={`Remove ${p}`} className="cursor-pointer" onClick={() => setList(list.filter((x) => x !== p))}>
              <X />
            </button>
          </Badge>
        ))}
        {!list.length && <span className="text-body text-muted-foreground">No pillars yet.</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={next}
          placeholder="Add a pillar, e.g. Recipes in 60 seconds"
          onChange={(e) => setNext(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && next.trim()) {
              e.preventDefault();
              setList([...list, next.trim()]);
              setNext("");
            }
          }}
        />
        <Button variant="secondary" disabled={!next.trim()} onClick={() => (setList([...list, next.trim()]), setNext(""))}>
          Add
        </Button>
        <Button
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate(list, { onSuccess: () => toast.success("Pillars saved"), onError: (e) => toast.error(errorMessage(e)) })}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function IdeaBank({ items, clientId }: { items: ContentItem[]; clientId: string }) {
  const clients = useClients();
  const can = useCan();
  const ideas = items.filter((i) => i.stage === "idea");
  const byClient = [...new Set(ideas.map((i) => i.client.id))];
  const client = clients.data?.find((c) => c.id === clientId);
  return (
    <div className="space-y-4">
      {client && can("content", "edit") && (
        <SectionCard title={`${client.name}'s content pillars`} description="The themes their content is planned around.">
          <PillarsEditor key={client.id} clientId={client.id} pillars={client.pillars} />
        </SectionCard>
      )}
      {!client && <Alert tone="info">Choose a client above to set their content pillars.</Alert>}
      {!ideas.length ? (
        <EmptyState icon={Lightbulb} title="The idea bank is empty for this month" description="Add ideas; they are offered to the client on the topic list." />
      ) : (
        byClient.map((cid) => {
          const list = ideas.filter((i) => i.client.id === cid);
          const pillars = [...new Set(list.map((i) => i.pillar || "No pillar"))];
          return (
            <SectionCard key={cid} title={list[0]!.client.name}>
              <div className="grid gap-3 md:grid-cols-2">
                {pillars.map((p) => (
                  <div key={p}>
                    <div className="mb-1.5 text-body font-medium text-text-secondary">{p}</div>
                    <ul className="space-y-1.5">
                      {list
                        .filter((i) => (i.pillar || "No pillar") === p)
                        .map((i) => (
                          <IdeaRow key={i.id} c={i} />
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </SectionCard>
          );
        })
      )}
    </div>
  );
}

function IdeaRow({ c }: { c: ContentItem }) {
  const can = useCan();
  const act = useContentAction(c.id);
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
      <Link href={`/app/content/${c.id}`} className="min-w-0 flex-1 truncate text-body hover:underline">
        {c.title}
      </Link>
      {can("content", "edit") && (
        <Button
          size="xs"
          variant="ghost"
          onClick={() =>
            act.mutate({ path: "/start" }, { onSuccess: () => toast.success("Started — it is in research"), onError: (e) => toast.error(errorMessage(e)) })
          }
        >
          Start
        </Button>
      )}
    </li>
  );
}

export function LiveContent() {
  const can = useCan();
  const clients = useClients();
  const [month, setMonth] = useState(thisMonth());
  const [clientId, setClientId] = useState("");
  const list = useContentList(`month=${month}${clientId ? `&clientId=${clientId}` : ""}`);
  const [adding, setAdding] = useState(false);
  const items = list.data ?? [];
  const counts = {
    ideas: items.filter((i) => i.stage === "idea").length,
    writing: items.filter((i) => i.stage === "script").length,
    withClient: items.filter((i) => i.stage === "approval").length,
    ready: items.filter((i) => i.stage === "ready").length,
  };
  return (
    <>
      <PageHeader
        title="Content"
        description="Ideas around each client's pillars, the monthly topic list they pick from, research and scripts. An approved script becomes a video in production."
        actions={
          can("content", "edit") && (
            <Button onClick={() => setAdding(true)}>
              <Plus />
              New idea
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        <Select
          aria-label="Client"
          className="w-56"
          value={clientId || "_all"}
          onValueChange={(v) => setClientId(v === "_all" ? "" : v)}
          options={[{ value: "_all", label: "All clients" }, ...(clients.data ?? []).filter((c) => !c.archivedAt).map((c) => ({ value: c.id, label: c.name }))]}
        />
        <span className="text-body text-muted-foreground">
          {counts.ideas} ideas · {counts.writing} being written · {counts.withClient} with the client · {counts.ready} ready for shoot
        </span>
      </div>
      {list.error && <Alert tone="danger">{errorMessage(list.error)}</Alert>}
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="topics">Topic lists</TabsTrigger>
          <TabsTrigger value="ideas">Idea bank</TabsTrigger>
        </TabsList>
        <TabsContent value="board">{list.isPending ? <SkeletonRows rows={6} /> : <Board items={items} />}</TabsContent>
        <TabsContent value="topics">
          <TopicLists month={month} clientId={clientId} />
        </TabsContent>
        <TabsContent value="ideas">{list.isPending ? <SkeletonRows rows={6} /> : <IdeaBank items={items} clientId={clientId} />}</TabsContent>
      </Tabs>
      {adding && <NewIdeaDialog clientId={clientId || undefined} month={month} open onOpenChange={setAdding} />}
    </>
  );
}

// ─── One idea, its research and script ─────────────────────────────────

function Stepper({ stage }: { stage: ContentItem["stage"] }) {
  const at = STAGES.indexOf(stage);
  return (
    <ol className="flex flex-wrap gap-1.5">
      {STAGES.map((s, i) => (
        <li
          key={s}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-body",
            i < at
              ? "border-success/30 bg-success-soft text-success"
              : i === at
                ? "border-primary bg-primary-soft font-medium text-primary"
                : "border-border text-muted-foreground",
          )}
        >
          {CONTENT_STAGE_LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

function Research({ c, canEdit }: { c: ContentItem; canEdit: boolean }) {
  const act = useContentAction(c.id);
  const [research, setResearch] = useState(c.research);
  const [links, setLinks] = useState(c.links);
  const [link, setLink] = useState({ label: "", url: "" });
  const dirty = research !== c.research || JSON.stringify(links) !== JSON.stringify(c.links);
  return (
    <SectionCard
      title="Research"
      description="Facts, references and hooks."
      actions={
        canEdit &&
        c.stage === "research" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              act.mutate({ path: "/research-done" }, { onSuccess: () => toast.success("Ready for the script"), onError: (e) => toast.error(errorMessage(e)) })
            }
          >
            <Check />
            Research done
          </Button>
        )
      }
    >
      <fieldset disabled={!canEdit} className="space-y-3">
        <Textarea rows={5} value={research} onChange={(e) => setResearch(e.target.value)} aria-label="Research notes" />
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.url} className="flex items-center gap-2 text-body">
              <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">
                {l.label}
              </a>
              <Button size="icon-sm" variant="ghost" aria-label={`Remove ${l.label}`} onClick={() => setLinks(links.filter((x) => x !== l))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Input placeholder="Reference" value={link.label} onChange={(e) => setLink({ ...link, label: e.target.value })} />
          <Input placeholder="https://…" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
          <Button variant="ghost" disabled={!link.label || !link.url} onClick={() => (setLinks([...links, link]), setLink({ label: "", url: "" }))}>
            Add
          </Button>
        </div>
        {canEdit && (
          <Button
            size="sm"
            disabled={!dirty || act.isPending}
            onClick={() =>
              act.mutate(
                { path: "", method: "PATCH", body: { research, links } },
                { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(errorMessage(e)) },
              )
            }
          >
            Save research
          </Button>
        )}
      </fieldset>
    </SectionCard>
  );
}

function Script({ c, canEdit, canApprove }: { c: ContentItem; canEdit: boolean; canApprove: boolean }) {
  const act = useContentAction(c.id);
  const last = c.scripts[0];
  const editable = canEdit && (c.stage === "research" || c.stage === "script");
  const [f, setF] = useState(() => ({ hook: last?.hook ?? "", body: last?.body ?? "", cta: last?.cta ?? "", onScreen: last?.onScreen ?? "" }));
  const [changes, setChanges] = useState(false);
  const dirty = !last || f.hook !== last.hook || f.body !== last.body || f.cta !== last.cta || f.onScreen !== last.onScreen;
  const run = (path: string, done: string, body?: unknown, method?: "PUT") =>
    act.mutate(
      { path, body, method },
      {
        onSuccess: (r) => {
          toast.success(done);
          if (r?.videoId) toast.info("It is now a video in production.");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  return (
    <SectionCard
      title="Script"
      description={last ? `${last.label} · ${SCRIPT_STATUS[last.status].label}${last.clientNote ? ` — “${last.clientNote}”` : ""}` : "Not written yet."}
    >
      <fieldset disabled={!editable} className="space-y-3">
        <Field label="Hook">
          <Textarea rows={2} value={f.hook} onChange={(e) => setF({ ...f, hook: e.target.value })} />
        </Field>
        <Field label="Script">
          <Textarea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Call to action">
            <Textarea rows={2} value={f.cta} onChange={(e) => setF({ ...f, cta: e.target.value })} />
          </Field>
          <Field label="On-screen text">
            <Textarea rows={2} value={f.onScreen} onChange={(e) => setF({ ...f, onScreen: e.target.value })} />
          </Field>
        </div>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2">
        {editable && (
          <Button
            size="sm"
            disabled={!dirty || act.isPending}
            onClick={() => {
              const parsed = scriptInput.safeParse(f);
              if (!parsed.success) return toast.error(parsed.error.issues[0]!.message);
              run("/script", "Script saved", parsed.data, "PUT");
            }}
          >
            Save
          </Button>
        )}
        {editable && last?.status === "draft" && !dirty && (
          <Button size="sm" variant="secondary" onClick={() => run("/script/review", "Sent for review")}>
            Ask for review
          </Button>
        )}
        {canApprove && last && (last.status === "draft" || last.status === "review") && !dirty && c.stage !== "approval" && (
          <Button size="sm" variant="soft" onClick={() => run("/script/send", "Sent to the client")}>
            <ShieldCheck />
            Approve and send to the client
          </Button>
        )}
        {canEdit && c.stage === "approval" && (
          <>
            <Button size="sm" variant="success" onClick={() => run("/script/decision", "Approved — it is now a video", { approved: true })}>
              <ThumbsUp />
              Client approved
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setChanges(true)}>
              <MessageSquareReply />
              Client wants changes
            </Button>
          </>
        )}
      </div>
      {c.scripts.length > 1 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-body font-medium text-text-secondary">Earlier versions</summary>
          <ul className="mt-2 space-y-2">
            {c.scripts.slice(1).map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-2.5 text-body">
                <div className="font-medium">
                  {s.label} · {SCRIPT_STATUS[s.status].label}
                </div>
                {s.clientNote && <div className="text-muted-foreground">“{s.clientNote}”</div>}
                <div className="mt-1 whitespace-pre-line text-muted-foreground">{s.hook}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
      <NoteDialog
        open={changes}
        title="What does the client want changed?"
        description="The script goes back to the writer with this note."
        required
        confirm="Send back"
        onClose={() => setChanges(false)}
        onConfirm={(note) => {
          setChanges(false);
          run("/script/decision", "Sent back to the writer", { approved: false, note });
        }}
      />
    </SectionCard>
  );
}

export function LiveContentItem({ id }: { id: string }) {
  const can = useCan();
  const content = useContent(id);
  const act = useContentAction(id);
  if (content.isPending) return <SkeletonRows rows={8} />;
  if (content.error) return <Alert tone="danger">{errorMessage(content.error)}</Alert>;
  const c = content.data;
  const canEdit = can("content", "edit");
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/content">
          <ArrowLeft />
          Content
        </Link>
      </Button>
      <PageHeader
        eyebrow={<Badge tone="outline">{c.client.name}</Badge>}
        title={c.title}
        description={`${monthLabel(c.month)} · ${c.format}${c.pillar ? ` · ${c.pillar}` : ""}${c.owner?.name ? ` · ${c.owner.name}` : ""}`}
        actions={
          canEdit &&
          (c.stage === "idea" || c.stage === "topic") && (
            <Button
              variant="secondary"
              onClick={() => act.mutate({ path: "/start" }, { onSuccess: () => toast.success("Started"), onError: (e) => toast.error(errorMessage(e)) })}
            >
              Start research
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Stepper stage={c.stage} />
      </div>
      {c.video && (
        <Alert tone="success" className="mb-4">
          In production as{" "}
          <Link href={`/app/production/${c.video.id}`} className="font-medium underline">
            {c.video.code}
          </Link>{" "}
          — <StageBadge stage={c.video.stage} />
        </Alert>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Script key={`${c.scripts[0]?.id}-${c.scripts[0]?.status}`} c={c} canEdit={canEdit} canApprove={can("content", "approve")} />
        <div className="space-y-4">
          <Research key={c.updatedAt} c={c} canEdit={canEdit} />
          {c.notes && (
            <SectionCard title="Notes">
              <p className="whitespace-pre-line text-body">{c.notes}</p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
