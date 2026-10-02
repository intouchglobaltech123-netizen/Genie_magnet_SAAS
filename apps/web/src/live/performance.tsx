"use client";

import { useState } from "react";
import { BookOpen, Check, ExternalLink, Plus, RefreshCw, Send, Star, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  type Kra,
  KRA_METRIC_LABEL,
  KRA_METRICS,
  type KraMetric,
  type KraTemplateRow,
  type LearningPathRow,
  type MonthScorecardRow,
  PLAYER_LABEL,
  PLAYER_TRAIT_LABEL,
  PLAYER_TRAITS,
  type Player,
  type PlayerTrait,
  SKILL_LEVEL_LABEL,
  type TeamMemberRow,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { MonthSwitcher, monthLabel, thisMonth } from "./production-bits";
import {
  useCan,
  useKraTemplates,
  useLeaderboard,
  useLearningAction,
  useLearningAssignments,
  useLearningPaths,
  useMe,
  useMyScorecards,
  usePeople,
  usePerformanceAction,
  usePerformanceSettings,
  usePerformanceTeam,
  usePlayerRatings,
  useScorecard,
  useSkillMatrix,
} from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const issuesOf = (setErrors: (e: Record<string, string>) => void) => (e: unknown) =>
  e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : onError(e);
const PLAYER_TONE: Record<Player, BadgeTone> = { A: "success", B_competence: "info", B_commitment: "warning", C: "danger" };
const scoreTone = (n: number): BadgeTone => (n >= 80 ? "success" : n >= 60 ? "warning" : "danger");
const newKey = () => Math.random().toString(36).slice(2, 10);

// ─── A month's scorecard ──────────────────────────────────────────────

function ScorecardDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const me = useMe().data!;
  const card = useScorecard(id);
  const act = usePerformanceAction();
  const [actuals, setActuals] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const c = card.data;
  const own = c?.user.id === me.user.id;
  const editable = !!c && c.status === "draft" && (!own || me.role?.key === "owner");
  const values = actuals ?? Object.fromEntries((c?.kras ?? []).map((k) => [k.key, k.actual === null ? "" : String(k.actual)]));
  const save = (then?: () => void) =>
    act.mutate(
      {
        step: "update",
        id,
        actuals: Object.fromEntries(
          (c?.kras ?? [])
            .filter((k) => values[k.key] !== (k.actual === null ? "" : String(k.actual)))
            .map((k) => [k.key, values[k.key] === "" ? null : Number(values[k.key])]),
        ),
        note: note ?? c?.note ?? "",
      },
      { onSuccess: () => (setActuals(null), then ? then() : toast.success("Saved")), onError },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        {!c ? (
          <DialogBody>{card.error ? <Alert tone="danger">{errorMessage(card.error)}</Alert> : <SkeletonRows rows={5} />}</DialogBody>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {c.user.name} · {monthLabel(c.month)}
                <Badge tone={scoreTone(c.score)}>{c.score}</Badge>
                <Badge tone={c.status === "shared" ? "success" : "neutral"}>{c.status === "shared" ? "Shared" : "Draft"}</Badge>
              </DialogTitle>
              <DialogDescription>
                {c.template}
                {c.reviewer && ` · reviewed by ${c.reviewer.name}`}. Each KRA counts its share of the target, up to the target, times its weight.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Card className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR>
                      <TH>KRA</TH>
                      <TH numeric>Target</TH>
                      <TH numeric>Achieved</TH>
                      <TH numeric>Weight</TH>
                      <TH numeric>Points</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {c.kras.map((k) => (
                      <TR key={k.key}>
                        <TD>
                          <div className="font-medium">{k.name}</div>
                          <div className="text-muted-foreground">
                            {k.measure || (k.metric ? KRA_METRIC_LABEL[k.metric].label : "")}
                            {k.lowerIsBetter && " · lower is better"}
                          </div>
                        </TD>
                        <TD numeric>
                          {k.target}
                          {k.unit}
                        </TD>
                        <TD numeric>
                          {editable ? (
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              className="ml-auto w-24 text-right"
                              aria-label={`${k.name} achieved`}
                              value={values[k.key] ?? ""}
                              onChange={(e) => setActuals({ ...values, [k.key]: e.target.value })}
                            />
                          ) : k.actual === null ? (
                            "—"
                          ) : (
                            `${k.actual}${k.unit}`
                          )}
                          {k.auto && <div className="text-[11px] text-muted-foreground">from the app</div>}
                        </TD>
                        <TD numeric>{k.weight}</TD>
                        <TD numeric>{k.achieved === null ? "—" : Math.round(k.achieved * k.weight * 10) / 10}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
              {c.gate && (
                <p className={cn("text-body", c.gated ? "text-danger" : "text-muted-foreground")}>
                  Quality gate: {c.kras.find((k) => k.key === c.gate!.key)?.name} below {c.gate.threshold} caps the score at {c.gate.cap}
                  {c.gated ? ` — it does this month (${c.raw} capped).` : "."}
                </p>
              )}
              {editable ? (
                <Field label="Note to them">
                  <Textarea rows={2} value={note ?? c.note} onChange={(e) => setNote(e.target.value)} />
                </Field>
              ) : (
                c.note && <p className="text-body">{c.note}</p>
              )}
              {c.reply && (
                <Alert tone="info">
                  {c.user.name} replied: {c.reply}
                </Alert>
              )}
              {own && c.status === "shared" && (
                <div className="flex gap-2">
                  <Input placeholder="Your reply" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <Button
                    variant="secondary"
                    disabled={!reply.trim()}
                    onClick={() => act.mutate({ step: "reply", id, text: reply }, { onSuccess: () => (setReply(""), toast.success("Sent")), onError })}
                  >
                    <Send />
                    Reply
                  </Button>
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              {editable && (
                <>
                  <Button
                    variant="ghost"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({ step: "refresh", id }, { onSuccess: () => (setActuals(null), toast.success("Figures filled in again")), onError })
                    }
                  >
                    <RefreshCw />
                    Fill the app&rsquo;s figures again
                  </Button>
                  <Button variant="secondary" disabled={act.isPending} onClick={() => save()}>
                    Save
                  </Button>
                  <Button
                    disabled={act.isPending}
                    onClick={() => save(() => act.mutate({ step: "share", id }, { onSuccess: () => toast.success("Shared — they are told"), onError }))}
                  >
                    <Send />
                    Share with them
                  </Button>
                </>
              )}
              {c.status === "shared" && !own && (
                <Button variant="ghost" onClick={() => act.mutate({ step: "reopen", id }, { onError })}>
                  Open it again
                </Button>
              )}
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RatingDialog({ person, month, onClose }: { person: TeamMemberRow; month: string; onClose: () => void }) {
  const act = usePerformanceAction();
  const ratings = usePlayerRatings(month);
  const current = ratings.data?.find((r) => r.user.id === person.user.id);
  const [r, setR] = useState<Record<PlayerTrait, number> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const values = r ?? current?.ratings ?? { skill: 0, knowledge: 0, selfImage: 0, motive: 0, trait: 0 };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Rate {person.user.name} · {monthLabel(month)}
          </DialogTitle>
          <DialogDescription>Competence (skill, knowledge) and commitment (self image, motive, trait), each 1 to 5.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {PLAYER_TRAITS.map((k) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-body">{PLAYER_TRAIT_LABEL[k]}</span>
              <div className="flex gap-1" role="radiogroup" aria-label={PLAYER_TRAIT_LABEL[k]}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={values[k] === n}
                    onClick={() => setR((x) => ({ ...(x ?? values), [k]: n }))}
                    className={cn(
                      "size-8 rounded-lg border text-body",
                      values[k] === n ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Field label="Note">
            <Input value={note ?? current?.note ?? ""} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {current && (
            <p className="text-body">
              Now: <Badge tone={PLAYER_TONE[current.player]}>{PLAYER_LABEL[current.player].label}</Badge> — {PLAYER_LABEL[current.player].action}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={act.isPending || PLAYER_TRAITS.some((k) => !values[k])}
            onClick={() =>
              act.mutate(
                { step: "rate", userId: person.user.id, body: { month, ratings: values, note: note ?? current?.note ?? "" } },
                { onSuccess: () => (toast.success("Rated"), onClose()), onError },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyMonths({ onOpen }: { onOpen: (id: string) => void }) {
  const mine = useMyScorecards();
  if (mine.isPending) return <SkeletonRows rows={3} />;
  if (!mine.data?.length)
    return <EmptyState icon={Star} title="No scorecards yet" description="Your month's scorecard shows here once your manager shares it." />;
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Month</TH>
            <TH>KRAs</TH>
            <TH numeric>Score</TH>
          </TR>
        </THead>
        <TBody>
          {mine.data.map((c) => (
            <TR key={c.id} className="cursor-pointer" onClick={() => onOpen(c.id)}>
              <TD className="font-medium">{monthLabel(c.month)}</TD>
              <TD>{c.template}</TD>
              <TD numeric>
                <Badge tone={scoreTone(c.score)}>{c.score}</Badge>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

function Team({ month, onOpen }: { month: string; onOpen: (id: string) => void }) {
  const team = usePerformanceTeam(month);
  const act = usePerformanceAction();
  const [rating, setRating] = useState<TeamMemberRow | null>(null);
  if (team.isPending) return <SkeletonRows rows={5} />;
  if (!team.data?.length)
    return <EmptyState title="No one reports to you" description="People show here when HR sets you as their manager, or you head their department." />;
  return (
    <>
      <Card className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Person</TH>
              <TH>KRAs</TH>
              <TH>{monthLabel(month)}</TH>
              <TH>Rating</TH>
            </TR>
          </THead>
          <TBody>
            {team.data.map((p) => (
              <TR key={p.user.id}>
                <TD>
                  <div className="font-medium">{p.user.name}</div>
                  <div className="text-muted-foreground">{p.designation ?? ""}</div>
                </TD>
                <TD>{p.template?.name ?? <span className="text-muted-foreground">Not chosen</span>}</TD>
                <TD>
                  {p.scorecard ? (
                    <Button size="xs" variant="secondary" onClick={() => onOpen(p.scorecard!.id)}>
                      {p.scorecard.score} · {p.scorecard.status === "shared" ? "shared" : "draft"}
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      disabled={!p.template || act.isPending}
                      onClick={() =>
                        act.mutate({ step: "start", userId: p.user.id, month }, { onSuccess: (r) => onOpen((r as MonthScorecardRow).id), onError })
                      }
                    >
                      Start the month
                    </Button>
                  )}
                </TD>
                <TD>
                  <Button size="xs" variant="ghost" onClick={() => setRating(p)}>
                    {p.player ? <Badge tone={PLAYER_TONE[p.player]}>{PLAYER_LABEL[p.player].label}</Badge> : "Rate"}
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      {rating && <RatingDialog person={rating} month={month} onClose={() => setRating(null)} />}
    </>
  );
}

function Leaderboard({ month }: { month: string }) {
  const board = useLeaderboard(month);
  if (board.isPending) return <SkeletonRows rows={5} />;
  if (board.error) return <Alert tone="info">{errorMessage(board.error)}</Alert>;
  if (!board.data.length)
    return <EmptyState icon={Trophy} title="Nothing shared yet" description="Scores show here once managers share the month's scorecards." />;
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>#</TH>
            <TH>Person</TH>
            <TH>KRAs</TH>
            <TH numeric>Score</TH>
            <TH numeric>From last month</TH>
          </TR>
        </THead>
        <TBody>
          {board.data.map((r) => (
            <TR key={r.user.id}>
              <TD className="font-semibold">{r.rank}</TD>
              <TD className="font-medium">{r.user.name}</TD>
              <TD>{r.template}</TD>
              <TD numeric>
                <Badge tone={scoreTone(r.score)}>{r.score}</Badge>
              </TD>
              <TD numeric className={cn(r.change !== null && (r.change >= 0 ? "text-success" : "text-danger"))}>
                {r.change === null ? "—" : `${r.change > 0 ? "+" : ""}${r.change}`}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

type KraDraft = Omit<Kra, "target" | "weight"> & { target: string; weight: string };

function TemplateDialog({ t, onClose }: { t: KraTemplateRow | null; onClose: () => void }) {
  const act = usePerformanceAction();
  const [name, setName] = useState(t?.name ?? "");
  const [kras, setKras] = useState<KraDraft[]>(
    (t?.kras ?? [{ key: newKey(), name: "", measure: "", unit: "", target: 0, weight: 100, lowerIsBetter: false, metric: null }]).map((k) => ({
      ...k,
      target: String(k.target),
      weight: String(k.weight),
    })),
  );
  const [gate, setGate] = useState({ key: t?.gate?.key ?? "", threshold: String(t?.gate?.threshold ?? ""), cap: String(t?.gate?.cap ?? "") });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (i: number, patch: Partial<KraDraft>) => setKras(kras.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const total = kras.reduce((s, k) => s + (Number(k.weight) || 0), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t ? t.name : "New KRA template"}</DialogTitle>
          <DialogDescription>
            The KRAs a role is scored on each month. Pick a figure the app knows to have it filled in; the rest the manager enters.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="Name" error={errors.name}>
            <Input value={name} placeholder="e.g. Video Editor" onChange={(e) => setName(e.target.value)} />
          </Field>
          {kras.map((k, i) => (
            <div key={k.key} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
              <Field label="KRA">
                <Input value={k.name} placeholder="e.g. Videos approved" onChange={(e) => set(i, { name: e.target.value })} />
              </Field>
              <Field label="Filled in from">
                <Select
                  value={k.metric ?? "_manual"}
                  onValueChange={(v) => {
                    const metric = v === "_manual" ? null : (v as KraMetric);
                    set(i, { metric, ...(metric && { unit: KRA_METRIC_LABEL[metric].unit, lowerIsBetter: !!KRA_METRIC_LABEL[metric].lowerIsBetter }) });
                  }}
                  options={[{ value: "_manual", label: "Entered by the manager" }, ...KRA_METRICS.map((m) => ({ value: m, label: KRA_METRIC_LABEL[m].label }))]}
                />
              </Field>
              <Field label="Target">
                <Input type="number" min={0} step="any" value={k.target} onChange={(e) => set(i, { target: e.target.value })} />
              </Field>
              <Field label="Weight">
                <Input type="number" min={0} max={100} value={k.weight} onChange={(e) => set(i, { weight: e.target.value })} />
              </Field>
              <div className="flex items-end">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${k.name || "this KRA"}`}
                  disabled={kras.length === 1}
                  onClick={() => setKras(kras.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              <Field label="How it is measured" className="sm:col-span-3">
                <Input value={k.measure} onChange={(e) => set(i, { measure: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-body sm:col-span-2 sm:self-end sm:pb-2">
                <Switch aria-label="Lower is better" checked={k.lowerIsBetter} onCheckedChange={(lowerIsBetter) => set(i, { lowerIsBetter })} />
                Lower is better
              </label>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setKras([...kras, { key: newKey(), name: "", measure: "", unit: "", target: "", weight: "0", lowerIsBetter: false, metric: null }])
              }
            >
              <Plus />
              Add a KRA
            </Button>
            <span className={cn("text-body", total === 100 ? "text-muted-foreground" : "text-danger")}>Weights: {total} of 100</span>
          </div>
          {errors.kras && <Alert tone="danger">{errors.kras}</Alert>}
          <SectionCard title="Quality gate" description="Optional: when one KRA falls below a level, the month's score is capped.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="KRA" error={errors.gate}>
                <Select
                  value={gate.key || "_none"}
                  onValueChange={(v) => setGate({ ...gate, key: v === "_none" ? "" : v })}
                  options={[{ value: "_none", label: "No gate" }, ...kras.map((k) => ({ value: k.key, label: k.name || "Unnamed" }))]}
                />
              </Field>
              <Field label="Below">
                <Input type="number" min={0} value={gate.threshold} onChange={(e) => setGate({ ...gate, threshold: e.target.value })} />
              </Field>
              <Field label="Caps the score at">
                <Input type="number" min={0} max={100} value={gate.cap} onChange={(e) => setGate({ ...gate, cap: e.target.value })} />
              </Field>
            </div>
          </SectionCard>
        </DialogBody>
        <DialogFooter>
          {t && (
            <Button variant="ghost" className="mr-auto" onClick={() => act.mutate({ step: "removeTemplate", id: t.id }, { onSuccess: onClose, onError })}>
              <Trash2 />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "template",
                  id: t?.id,
                  body: {
                    name,
                    kras: kras.map((k) => ({ ...k, target: Number(k.target) || 0, weight: Number(k.weight) || 0 })),
                    gate: gate.key ? { key: gate.key, threshold: Number(gate.threshold) || 0, cap: Number(gate.cap) || 0 } : null,
                  },
                },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError: issuesOf(setErrors) },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Templates() {
  const can = useCan();
  const list = useKraTemplates();
  const settings = usePerformanceSettings();
  const act = usePerformanceAction();
  const [open, setOpen] = useState<KraTemplateRow | "new" | null>(null);
  const s = settings.data;
  return (
    <div className="space-y-4">
      {list.isPending ? (
        <SkeletonRows rows={3} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.data?.map((t) => (
            <Card
              key={t.id}
              className={cn("p-4", can("hr", "edit") && "cursor-pointer hover:border-primary/40")}
              onClick={() => can("hr", "edit") && setOpen(t)}
            >
              <div className="font-semibold">{t.name}</div>
              <ul className="mt-2 space-y-0.5 text-body">
                {t.kras.map((k) => (
                  <li key={k.key} className="flex justify-between gap-2">
                    <span>
                      {k.name}
                      {k.metric && <span className="text-muted-foreground"> · from the app</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {k.target}
                      {k.unit} · {k.weight}%
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-body text-muted-foreground">
                {t.people.length ? t.people.map((p) => p.name).join(", ") : "No one on it yet — choose it on their employee record."}
              </div>
            </Card>
          ))}
        </div>
      )}
      {can("hr", "edit") && (
        <Button onClick={() => setOpen("new")}>
          <Plus />
          New KRA template
        </Button>
      )}
      {can("hr", "edit") && s && (
        <SectionCard title="Your rule" description="The bar for the A–C rating, and who sees what.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Each rating at least (the bar)">
              <Input
                type="number"
                min={1}
                max={5}
                defaultValue={s.bar}
                onBlur={(e) => act.mutate({ step: "settings", body: { ...s, bar: Number(e.target.value) } }, { onError })}
              />
            </Field>
            <Field label="Or a total of at least (A player)">
              <Input
                type="number"
                min={5}
                max={25}
                defaultValue={s.aTotal}
                onBlur={(e) => act.mutate({ step: "settings", body: { ...s, aTotal: Number(e.target.value) } }, { onError })}
              />
            </Field>
            <Field label="Who sees the leaderboard">
              <Select
                value={s.leaderboard}
                onValueChange={(v) => act.mutate({ step: "settings", body: { ...s, leaderboard: v as typeof s.leaderboard } }, { onError })}
                options={[
                  { value: "managers", label: "Managers and HR" },
                  { value: "everyone", label: "Everyone" },
                ]}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-body">
              <Switch
                aria-label="People see their own rating"
                checked={s.showOwnRating}
                onCheckedChange={(showOwnRating) => act.mutate({ step: "settings", body: { ...s, showOwnRating } }, { onError })}
              />
              People see their own A–C rating
            </label>
          </div>
        </SectionCard>
      )}
      {open && <TemplateDialog t={open === "new" ? null : open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** /app/performance: my months, my team's months and ratings, the leaderboard, KRA templates. */
export function LivePerformance({ scorecardId }: { scorecardId?: string }) {
  const [tab, setTab] = useState("mine");
  const [month, setMonth] = useState(thisMonth());
  const [open, setOpen] = useState<string | null>(scorecardId ?? null);
  return (
    <>
      <PageHeader
        title="Performance"
        description="Each month scored on the role's KRAs — with what the app knows filled in — shared by the manager; the A–C rating; the leaderboard."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="mine">My months</TabsTrigger>
            <TabsTrigger value="team">My team</TabsTrigger>
            <TabsTrigger value="board">Leaderboard</TabsTrigger>
            <TabsTrigger value="kras">KRAs</TabsTrigger>
          </TabsList>
        </Tabs>
        {(tab === "team" || tab === "board") && <MonthSwitcher month={month} onChange={setMonth} />}
      </div>
      {tab === "mine" ? (
        <MyMonths onOpen={setOpen} />
      ) : tab === "team" ? (
        <Team month={month} onOpen={setOpen} />
      ) : tab === "board" ? (
        <Leaderboard month={month} />
      ) : (
        <Templates />
      )}
      {open && <ScorecardDialog id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Learning ─────────────────────────────────────────────────────────

function PathDialog({ path, onClose }: { path: LearningPathRow | null; onClose: () => void }) {
  const act = useLearningAction();
  const people = usePeople();
  const [f, setF] = useState({ title: path?.title ?? "", forRole: path?.forRole ?? "", description: path?.description ?? "", ownerId: path?.owner?.id ?? "" });
  const [modules, setModules] = useState((path?.modules ?? [{ key: newKey(), title: "", hours: 1, link: "" }]).map((m) => ({ ...m, hours: String(m.hours) })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{path ? path.title : "New learning path"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" error={errors.title}>
              <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
            <Field label="For">
              <Input value={f.forRole} placeholder="e.g. Video Editor" onChange={(e) => setF({ ...f, forRole: e.target.value })} />
            </Field>
            <Field label="Who keeps it">
              <Select
                value={f.ownerId || "_none"}
                onValueChange={(v) => setF({ ...f, ownerId: v === "_none" ? "" : v })}
                options={[{ value: "_none", label: "No one" }, ...(people.data ?? []).map((p) => ({ value: p.user.id, label: p.user.name }))]}
              />
            </Field>
            <Field label="What it is for" className="sm:col-span-2">
              <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </Field>
          </div>
          {modules.map((m, i) => (
            <div key={m.key} className="grid gap-2 sm:grid-cols-[2fr_80px_2fr_auto]">
              <Input
                placeholder="Module"
                value={m.title}
                onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              />
              <Input
                type="number"
                min={0}
                aria-label="Hours"
                value={m.hours}
                onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))}
              />
              <Input
                placeholder="https://… (optional)"
                value={m.link}
                onChange={(e) => setModules(modules.map((x, j) => (j === i ? { ...x, link: e.target.value } : x)))}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove module"
                disabled={modules.length === 1}
                onClick={() => setModules(modules.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {Object.entries(errors)
            .filter(([k]) => k.startsWith("modules"))
            .map(([k, v]) => (
              <p key={k} className="text-body text-danger">
                {v}
              </p>
            ))}
          <Button size="sm" variant="secondary" onClick={() => setModules([...modules, { key: newKey(), title: "", hours: "1", link: "" }])}>
            <Plus />
            Add a module
          </Button>
        </DialogBody>
        <DialogFooter>
          {path && (
            <Button variant="ghost" className="mr-auto" onClick={() => act.mutate({ step: "removePath", id: path.id }, { onSuccess: onClose, onError })}>
              <Trash2 />
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate(
                {
                  step: "path",
                  id: path?.id,
                  body: { ...f, ownerId: f.ownerId || null, modules: modules.map((m) => ({ ...m, hours: Number(m.hours) || 0 })) },
                },
                { onSuccess: () => (toast.success("Saved"), onClose()), onError: issuesOf(setErrors) },
              )
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ path, onClose }: { path: LearningPathRow; onClose: () => void }) {
  const can = useCan();
  const act = useLearningAction();
  const people = usePeople();
  const team = usePerformanceTeam(thisMonth());
  const choices = can("hr", "edit") ? (people.data ?? []).map((p) => p.user) : (team.data ?? []).map((p) => p.user);
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give “{path.title}”</DialogTitle>
          <DialogDescription>They are told, and mark each module done as they go.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-1.5">
          {!choices.length && <p className="text-body text-muted-foreground">No one reports to you.</p>}
          {choices.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-body">
              <Checkbox checked={chosen.includes(u.id)} onCheckedChange={(c) => setChosen(c === true ? [...chosen, u.id] : chosen.filter((x) => x !== u.id))} />
              {u.name}
            </label>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!chosen.length || act.isPending}
            onClick={() => act.mutate({ step: "assign", id: path.id, userIds: chosen }, { onSuccess: () => (toast.success("Given"), onClose()), onError })}
          >
            Give the path
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillsDialog({ skills, onClose }: { skills: { id: string; name: string; group: string }[]; onClose: () => void }) {
  const act = useLearningAction();
  const [rows, setRows] = useState<{ id?: string; name: string; group: string }[]>(skills.length ? skills : [{ name: "", group: "" }]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skills</DialogTitle>
          <DialogDescription>Renaming keeps everyone&rsquo;s levels; removing a skill removes them.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id ?? i} className="flex gap-2">
              <Input placeholder="Skill" value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <Input
                placeholder="Group (optional)"
                value={r.group}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))}
              />
              <Button size="icon-sm" variant="ghost" aria-label="Remove skill" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { name: "", group: "" }])}>
            <Plus />
            Add a skill
          </Button>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate({ step: "skills", skills: rows.filter((r) => r.name.trim()) }, { onSuccess: () => (toast.success("Saved"), onClose()), onError })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkillMatrixView() {
  const can = useCan();
  const me = useMe().data!;
  const m = useSkillMatrix();
  const act = useLearningAction();
  const [editing, setEditing] = useState(false);
  if (m.isPending) return <SkeletonRows rows={4} />;
  const data = m.data!;
  return (
    <div className="space-y-3">
      {!data.skills.length ? (
        <EmptyState title="No skills yet" description={can("hr", "edit") ? "List the skills your people grow in." : "HR lists the skills."} />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Person</TH>
                {data.skills.map((s) => (
                  <TH key={s.id}>
                    {s.name}
                    {s.group && <div className="font-normal text-muted-foreground">{s.group}</div>}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {data.people.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium">{p.name}</TD>
                  {data.skills.map((s) => {
                    const level = p.levels[s.id] ?? 0;
                    return (
                      <TD key={s.id}>
                        {p.id !== me.user.id || me.role?.key === "owner" ? (
                          <Select
                            value={String(level)}
                            onValueChange={(v) => act.mutate({ step: "level", skillId: s.id, userId: p.id, level: Number(v) }, { onError })}
                            options={SKILL_LEVEL_LABEL.map((l, i) => ({ value: String(i), label: `${i} · ${l}` }))}
                          />
                        ) : (
                          <span>
                            {level} · {SKILL_LEVEL_LABEL[level]}
                          </span>
                        )}
                      </TD>
                    );
                  })}
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
      {can("hr", "edit") && (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Change the skills
        </Button>
      )}
      {editing && <SkillsDialog skills={data.skills} onClose={() => setEditing(false)} />}
    </div>
  );
}

/** /app/learning: my paths, the agency's paths, the team's progress and the skill matrix. */
export function LiveLearning() {
  const can = useCan();
  const me = useMe().data!;
  const paths = useLearningPaths();
  const assignments = useLearningAssignments();
  const act = useLearningAction();
  const [tab, setTab] = useState("mine");
  const [editing, setEditing] = useState<LearningPathRow | "new" | null>(null);
  const [giving, setGiving] = useState<LearningPathRow | null>(null);
  const mine = (assignments.data ?? []).filter((a) => a.user.id === me.user.id);
  const others = (assignments.data ?? []).filter((a) => a.user.id !== me.user.id);
  return (
    <>
      <PageHeader
        title="Learning"
        description="Learning paths for each role, given by HR or your manager and marked done module by module; and the skill matrix."
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="mine">My learning</TabsTrigger>
          <TabsTrigger value="paths">Paths</TabsTrigger>
          <TabsTrigger value="team">The team&rsquo;s progress</TabsTrigger>
          <TabsTrigger value="skills">Skill matrix</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "mine" &&
        (assignments.isPending ? (
          <SkeletonRows rows={3} />
        ) : !mine.length ? (
          <EmptyState icon={BookOpen} title="No paths given to you yet" description="Paths your manager or HR gives you show here." />
        ) : (
          <div className="space-y-3">
            {mine.map((a) => {
              const path = paths.data?.find((p) => p.id === a.path.id);
              return (
                <SectionCard key={a.id} title={a.path.title} description={a.completedAt ? "Done" : `${a.progress}% done`}>
                  <Progress value={a.progress} tone={a.completedAt ? "success" : "accent"} className="mb-3" />
                  <ul className="space-y-1.5">
                    {path?.modules.map((m) => (
                      <li key={m.key} className="flex items-center gap-2 text-body">
                        <Checkbox
                          checked={a.done.includes(m.key)}
                          onCheckedChange={(c) => act.mutate({ step: "mark", id: a.id, key: m.key, done: c === true }, { onError })}
                          aria-label={m.title}
                        />
                        <span className={cn(a.done.includes(m.key) && "text-muted-foreground line-through")}>{m.title}</span>
                        <span className="text-muted-foreground">· {m.hours} h</span>
                        {m.link && (
                          <a href={m.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            Open <ExternalLink className="size-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              );
            })}
          </div>
        ))}
      {tab === "paths" && (
        <div className="space-y-3">
          {paths.isPending ? (
            <SkeletonRows rows={3} />
          ) : !paths.data?.length ? (
            <EmptyState
              icon={BookOpen}
              title="No learning paths yet"
              description={can("hr", "edit") ? "Put together the modules for a role." : "HR puts the paths together."}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {paths.data.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-body text-muted-foreground">
                        {[p.forRole, `${p.modules.length} modules`, `${p.hours} h`, p.owner && `kept by ${p.owner.name}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Badge tone="neutral">
                      {p.completed}/{p.assigned} done
                    </Badge>
                  </div>
                  {p.description && <p className="mt-2 text-body">{p.description}</p>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setGiving(p)}>
                      <Check />
                      Give to people
                    </Button>
                    {can("hr", "edit") && (
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        Change
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {can("hr", "edit") && (
            <Button onClick={() => setEditing("new")}>
              <Plus />
              New path
            </Button>
          )}
        </div>
      )}
      {tab === "team" &&
        (!others.length ? (
          <EmptyState title="Nothing to show" description="Paths given to the people you look after show here." />
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Person</TH>
                  <TH>Path</TH>
                  <TH>Progress</TH>
                </TR>
              </THead>
              <TBody>
                {others.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{a.user.name}</TD>
                    <TD>{a.path.title}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Progress value={a.progress} tone={a.completedAt ? "success" : "accent"} className="w-32" />
                        {a.progress}%
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        ))}
      {tab === "skills" && <SkillMatrixView />}
      {editing && <PathDialog path={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {giving && <AssignDialog path={giving} onClose={() => setGiving(null)} />}
    </>
  );
}
