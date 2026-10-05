"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ArrowRight, Check, Clapperboard, FileCheck2, Lightbulb, ListChecks, NotebookPen, Plus, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { WhatsAppSendDialog } from "@/components/shared/whatsapp-send-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { clientById, clients, personById, TODAY } from "@/lib/mock/core";
import type { Video } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { CONTENT_STAGES, pillarsByClient, type ContentItem, type TopicList } from "./data";
import { useContent } from "./store";

const FORMATS: Video["format"][] = ["Reel", "Long-form", "Ad", "Testimonial", "Podcast clip", "Explainer"];
/** "Dr. Arvind" keeps the title; everyone else is greeted by first name. */
export const greet = (name: string) => (name.startsWith("Dr.") ? name.split(" ").slice(0, 2).join(" ") : name.split(" ")[0]!);
export const waitingDays = (iso?: string) => (iso ? differenceInCalendarDays(parseISO(TODAY), parseISO(iso)) : 0);

export function ContentHub() {
  const items = useContent((s) => s.items);
  const lists = useContent((s) => s.lists);
  const [client, setClient] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const shown = client === "all" ? items : items.filter((i) => i.clientId === client);

  const awaiting = items.filter((i) => i.stage === "approval");
  const oldest = Math.max(0, ...awaiting.map((i) => waitingDays(i.sentOn)));
  const openLists = lists.filter((l) => l.status === "sent");

  return (
    <div>
      <PageHeader
        eyebrow="Client Delivery · Content"
        depth="demo"
        title="Content"
        description="Ideas become topics the client picks, then research, a script with versions and the client's approval — only then does a video enter production."
        actions={
          <>
            <Select
              aria-label="Filter by client"
              value={client}
              onValueChange={setClient}
              options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
              className="w-48"
            />
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus /> New idea
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Idea bank" value={items.filter((i) => i.stage === "idea").length} icon={Lightbulb} tone="gold" hint="not yet shown to clients" />
        <StatCard label="Topic lists with clients" value={openLists.length} icon={ListChecks} tone="info" hint={`${items.filter((i) => i.stage === "topic" && !i.pick).length} topics waiting for a pick`} />
        <StatCard label="Scripts in progress" value={items.filter((i) => i.stage === "research" || i.stage === "script").length} icon={NotebookPen} tone="accent" hint="research and writing" />
        <StatCard
          label="Awaiting client approval"
          value={awaiting.length}
          icon={FileCheck2}
          tone={oldest >= 2 ? "warning" : "success"}
          hint={awaiting.length ? `oldest waiting ${oldest} day${oldest === 1 ? "" : "s"}` : "nothing waiting"}
        />
      </div>

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="topics">Topic lists · {lists.length}</TabsTrigger>
          <TabsTrigger value="ideas">Idea bank · {items.filter((i) => i.stage === "idea").length}</TabsTrigger>
        </TabsList>
        <TabsContent value="board">
          <Board items={shown} />
        </TabsContent>
        <TabsContent value="topics">
          <TopicLists lists={client === "all" ? lists : lists.filter((l) => l.clientId === client)} />
        </TabsContent>
        <TabsContent value="ideas">
          <IdeaBank items={shown.filter((i) => i.stage === "idea")} client={client} />
        </TabsContent>
      </Tabs>

      <NewIdeaDialog key={client} open={newOpen} onOpenChange={setNewOpen} defaultClient={client === "all" ? "c-kaveri" : client} />
    </div>
  );
}

// ───────────────────────────── Board ─────────────────────────────

function Board({ items }: { items: ContentItem[] }) {
  return (
    <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
      {CONTENT_STAGES.map((st) => {
        const col = items.filter((i) => i.stage === st.id);
        const shown = st.id === "topic" || st.id === "idea" ? col.slice(0, 6) : col;
        return (
          <div key={st.id} className="flex w-[272px] shrink-0 flex-col rounded-2xl border border-border-subtle bg-surface-secondary/70">
            <div className="flex items-baseline justify-between gap-2 px-3.5 pb-2 pt-3">
              <div>
                <div className="text-body font-semibold">{st.label}</div>
                <div className="text-body text-muted-foreground">{st.hint}</div>
              </div>
              <Badge tone="neutral" className="tabular">
                {col.length}
              </Badge>
            </div>
            <div className="flex-1 space-y-2 px-2.5 pb-2.5">
              {shown.map((i) => (
                <ItemCard key={i.id} item={i} />
              ))}
              {col.length > shown.length && (
                <div className="px-1 py-1 text-body text-muted-foreground">
                  + {col.length - shown.length} more in {st.id === "topic" ? "Topic lists" : "the idea bank"}
                </div>
              )}
              {!col.length && <div className="rounded-xl border border-dashed border-border-strong p-4 text-center text-body text-muted-foreground">Nothing here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({ item }: { item: ContentItem }) {
  const c = clientById(item.clientId);
  const owner = personById(item.ownerId);
  const last = item.versions.at(-1);
  const wait = waitingDays(item.sentOn);
  return (
    <Link
      href={`/content/${item.id}`}
      className="block rounded-xl border border-border bg-card p-3 shadow-card transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
    >
      <div className="flex items-center justify-between gap-2 text-body text-muted-foreground">
        <span className="tabular-nums">{c.code}</span>
        <span className="truncate">{item.format}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-body font-medium text-text-primary">{item.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="outline">{item.pillar}</Badge>
        {item.source === "Genie Assistant" && (
          <Badge tone="gold">
            <Sparkles /> Genie
          </Badge>
        )}
        {item.stage === "topic" && item.pick && <Badge tone={item.pick === "picked" ? "success" : "neutral"}>{item.pick === "picked" ? "Client picked" : "Skipped"}</Badge>}
        {last && <Badge tone={last.status === "changes" ? "warning" : last.status === "approved" ? "success" : "neutral"}>{last.label}</Badge>}
        {item.stage === "approval" && <Badge tone={wait >= 2 ? "warning" : "info"}>Waiting {wait}d</Badge>}
        {item.videoCode && item.stage === "ready" && <Badge tone="success">{item.videoCode}</Badge>}
      </div>
      <div className="mt-2 flex items-center justify-between text-body text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={owner.name} size="xs" /> {owner.name.split(" ")[0]}
        </span>
        <span>due {fmtDate(item.due)}</span>
      </div>
    </Link>
  );
}

// ───────────────────────────── Topic lists ─────────────────────────────

function TopicLists({ lists }: { lists: TopicList[] }) {
  if (!lists.length) return <EmptyState icon={ListChecks} title="No topic lists" description="Topic lists are prepared each month from the idea bank." />;
  return (
    <div className="space-y-4">
      {lists.map((l) => (
        <TopicListCard key={l.id} list={l} />
      ))}
    </div>
  );
}

function TopicListCard({ list }: { list: TopicList }) {
  const items = useContent((s) => s.items);
  const sendList = useContent((s) => s.sendList);
  const confirmList = useContent((s) => s.confirmList);
  const setPick = useContent((s) => s.setPick);
  const [sending, setSending] = useState(false);
  const c = clientById(list.clientId);
  const approver = c.contacts.find((x) => x.approver) ?? c.contacts[0]!;
  const mine = items.filter((i) => i.clientId === list.clientId && i.month === list.month && (list.status === "draft" ? i.stage === "idea" : i.stage === "topic"));
  const picked = mine.filter((i) => i.pick === "picked").length;
  const confirmed = list.status === "confirmed";

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {c.name} · {list.month}
            <Badge tone={confirmed ? "success" : list.status === "sent" ? "info" : "neutral"}>
              {confirmed ? "Confirmed" : list.status === "sent" ? `With client · sent ${fmtDate(list.sentOn!)}` : "Draft"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Package includes {list.needed} deliverables · {mine.length} topics proposed · {c.contacts[0]!.name.split(" ")[0]} picks {list.needed} in the Client Hub or on WhatsApp
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {list.status === "draft" && (
            <Button size="sm" onClick={() => setSending(true)} disabled={!mine.length}>
              <Send /> Send to client
            </Button>
          )}
          {list.status === "sent" && (
            <>
              {list.clientId === "c-kaveri" && (
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/portal">
                    See client&apos;s view <ArrowRight />
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant={picked >= list.needed ? "default" : "outline"}
                onClick={() => {
                  confirmList(list.id);
                  toast.success(`${list.month} topics confirmed`, { description: `${picked} topics move to research; the rest go back to the idea bank.` });
                }}
              >
                <Check /> Confirm topics
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.status !== "draft" && (
          <div>
            <div className="flex justify-between text-body">
              <span className="font-medium">Client picks</span>
              <span className="tabular text-muted-foreground">
                {picked} of {list.needed}
              </span>
            </div>
            <Progress className="mt-1.5" value={(picked / list.needed) * 100} tone={picked >= list.needed ? "success" : "accent"} />
          </div>
        )}
        {confirmed ? (
          <p className="text-body text-muted-foreground">Topics are in research. Track them on the board.</p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border">
            {mine.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium">{i.title}</div>
                  <div className="text-body text-muted-foreground">
                    {i.pillar} · {i.format}
                    {i.source === "Genie Assistant" && " · suggested by Genie Assistant"}
                  </div>
                </div>
                {list.status === "sent" ? (
                  <div className="flex items-center gap-1.5">
                    {i.pick ? <Badge tone={i.pick === "picked" ? "success" : "neutral"}>{i.pick === "picked" ? "Picked" : "Skipped"}</Badge> : <Badge tone="warning">Waiting</Badge>}
                    <Button size="xs" variant="ghost" aria-label={`Mark ${i.title} as picked`} onClick={() => setPick(i.id, i.pick === "picked" ? undefined : "picked")}>
                      <Check />
                    </Button>
                    <Button size="xs" variant="ghost" aria-label={`Mark ${i.title} as skipped`} onClick={() => setPick(i.id, i.pick === "skipped" ? undefined : "skipped")}>
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Badge tone="outline">In draft</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <WhatsAppSendDialog
        open={sending}
        onOpenChange={setSending}
        title={`Send ${list.month} topic list`}
        description={`${approver.name} picks ${list.needed} topics in the Client Hub.`}
        to={{ name: approver.name, phone: approver.phone }}
        templateId="approval_request"
        vars={{ name: greet(approver.name), item: `${list.month} topic list`, title: `${mine.length} topic ideas — pick ${list.needed}` }}
        onSend={() => {
          sendList(list.id);
          toast.success("Topic list sent", { description: `Genie Assistant reminds ${greet(approver.name)} if there are no picks in 2 days.` });
        }}
      />
    </Card>
  );
}

// ───────────────────────────── Idea bank ─────────────────────────────

const GENIE_IDEAS: Record<string, [string, string, Video["format"]][]> = {
  "c-kaveri": [
    ["Kitchen myths: does ghee really raise cholesterol?", "Healthy swaps", "Reel"],
    ["Pongal special — Kaveri jaggery pongal in 10 minutes", "Recipes in 60 seconds", "Reel"],
    ["Ramesh answers your top 5 questions", "Founder & family", "Long-form"],
  ],
  "c-lakshmi": [
    ["Karthigai Deepam — lamp-lit saree looks", "Festive looks", "Reel"],
    ["Silk care after the festival — 4 steps", "Silk know-how", "Reel"],
    ["A weaver's daughter chooses her wedding saree", "Customer stories", "Testimonial"],
  ],
  "c-nova": [
    ["Sweets season: protect your teeth this Deepavali", "Myth vs fact", "Reel"],
    ["Sensitive teeth — 3 everyday causes", "Myth vs fact", "Reel"],
    ["Braces at 30? Yes, and here's how", "Treatments explained", "Reel"],
  ],
  "c-bright": [["Last 60 days before NEET — a study plan", "Exam tips", "Reel"]],
  "c-urban": [["Home loan in 5 steps — Vikram explains", "Buyer education", "Reel"]],
};

function IdeaBank({ items, client }: { items: ContentItem[]; client: string }) {
  const addIdea = useContent((s) => s.addIdea);
  const move = useContent((s) => s.move);
  const [asked, setAsked] = useState<string[]>([]);
  const byPillar = useMemo(() => {
    const m = new Map<string, ContentItem[]>();
    for (const i of items) m.set(`${i.clientId}|${i.pillar}`, [...(m.get(`${i.clientId}|${i.pillar}`) ?? []), i]);
    return m;
  }, [items]);

  const askGenie = () => {
    const target = client === "all" ? "c-kaveri" : client;
    if (asked.includes(target)) {
      toast("Genie Assistant already suggested ideas for this client today");
      return;
    }
    for (const [title, pillar, format] of GENIE_IDEAS[target] ?? []) addIdea({ clientId: target, title, pillar, format, source: "Genie Assistant", ownerId: "f-keerthana" });
    setAsked((a) => [...a, target]);
    toast.success(`${(GENIE_IDEAS[target] ?? []).length} ideas from Genie Assistant`, {
      description: `Based on ${clientById(target).name}'s content pillars, festivals ahead and what performed best last month. Review before they reach the client.`,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1 text-body">
          <div className="font-semibold">Ask Genie for ideas</div>
          <div className="text-muted-foreground">Suggestions use the client&apos;s approved content pillars, upcoming festivals and last month&apos;s best posts. A person reviews every idea.</div>
        </div>
        <Button size="sm" variant="soft" onClick={askGenie}>
          <Sparkles /> Suggest 3 ideas{client === "all" ? " for Kaveri" : ""}
        </Button>
      </Card>
      {!items.length && <EmptyState icon={Lightbulb} title="Idea bank is empty" description="Add an idea, or ask Genie Assistant for suggestions." compact />}
      {[...byPillar.entries()].map(([key, list]) => {
        const [cid, pillar] = key.split("|");
        return (
          <div key={key}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-body font-semibold">{pillar}</h3>
              <span className="text-body text-muted-foreground">{clientById(cid!).name}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((i) => (
                <Card key={i.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/content/${i.id}`} className="text-body font-medium hover:text-primary hover:underline">
                      {i.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="outline">{i.format}</Badge>
                      {i.source === "Genie Assistant" ? (
                        <Badge tone="gold">
                          <Sparkles /> Genie
                        </Badge>
                      ) : (
                        <Badge tone="neutral">{i.source}</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      move(i.id, "research");
                      toast.success("Moved to research", { description: "Use this for urgent topics the client has already agreed on a call." });
                    }}
                  >
                    Start <ArrowRight />
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewIdeaDialog({ open, onOpenChange, defaultClient }: { open: boolean; onOpenChange: (o: boolean) => void; defaultClient: string }) {
  const addIdea = useContent((s) => s.addIdea);
  const [clientId, setClientId] = useState(defaultClient);
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState("");
  const [format, setFormat] = useState<Video["format"]>("Reel");
  const pillars = pillarsByClient[clientId] ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New idea</DialogTitle>
          <DialogDescription>Ideas stay internal until they go on the client&apos;s monthly topic list.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Client" required>
            <Select
              value={clientId}
              onValueChange={(v) => {
                setClientId(v);
                setPillar("");
              }}
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Idea" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3 festive recipes with jaggery" autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Content pillar" required>
              <Select value={pillar} onValueChange={setPillar} placeholder="Choose a pillar" options={pillars.map((p) => ({ value: p, label: p }))} />
            </Field>
            <Field label="Format">
              <Select value={format} onValueChange={(v) => setFormat(v as Video["format"])} options={FORMATS.map((f) => ({ value: f, label: f }))} />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !pillar}
            onClick={() => {
              addIdea({ clientId, title: title.trim(), pillar, format, source: "Team", ownerId: "p-karthik" });
              toast.success("Idea added to the bank", { description: `${clientById(clientId).name} · ${pillar}` });
              setTitle("");
              onOpenChange(false);
            }}
          >
            <Clapperboard /> Add idea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
