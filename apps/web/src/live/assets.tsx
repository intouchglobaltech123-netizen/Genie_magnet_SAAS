"use client";

import { useState } from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CalendarPlus,
  History,
  IndianRupee,
  LayoutGrid,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  TrendingDown,
  TriangleAlert,
  Undo2,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  annualDepreciation,
  ASSET_CATEGORIES,
  ASSET_CONDITIONS,
  ASSET_STATUS_LABEL,
  ASSET_STATUSES,
  type AssetCategory,
  type AssetCondition,
  type AssetDetail,
  type AssetReservationRow,
  type AssetRow,
  type AssetStatus,
  bookValueOn,
  defaultHoursPerYear,
  depreciationSchedule,
  monthDepreciation,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { errorMessage } from "./api";
import { useAsset, useAssetAction, useAssetPeople, useAssetReservations, useAssets, useAssetShoots, useCan, useMe } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
const dayFrom = (n: number) => new Date(Date.now() + 330 * 60_000 + n * 86_400_000).toISOString().slice(0, 10);
/** The day in India of a moment the server recorded. */
const istDay = (at: string) => new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(0, 10);
const longDate = (d: string) => fmtDate(d, { day: "numeric", month: "short", year: "numeric" });
const when = (at: string) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATUS_TONE: Record<AssetStatus, BadgeTone> = {
  available: "success",
  reserved: "info",
  checked_out: "accent",
  assigned: "info",
  maintenance: "warning",
  retired: "neutral",
};
const CONDITION_TONE: Record<AssetCondition, BadgeTone> = { Excellent: "success", Good: "info", Fair: "warning", "Needs repair": "danger" };

/** Equipment and assets (P5-20): the register, who has what, reservations, repairs and depreciation. */
export function LiveAssets() {
  const can = useCan();
  const q = useAssets();
  const [tab, setTab] = useState("register");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [today] = useState(() => dayFrom(0));
  const rows = q.data ?? [];
  const inUse = rows.filter((a) => a.status !== "retired");
  const cost = inUse.reduce((n, a) => n + a.purchaseValue, 0);
  const worth = inUse.reduce((n, a) => n + a.bookValue, 0);
  const thisMonth = inUse.reduce((n, a) => n + monthDepreciation(a, today.slice(0, 7)), 0);
  const out = inUse.filter((a) => a.out?.kind === "out");
  const overdue = out.filter((a) => a.out?.overdue).length;
  const repairs = inUse.filter((a) => a.status === "maintenance").length;

  return (
    <>
      <PageHeader
        title="Equipment and assets"
        description="Every camera, lens, light and computer: who has it, when it is booked, what it is worth now, and what an hour of its use costs a shoot."
        actions={
          can("equipment", "approve") && (
            <Button variant="accent" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add an item
            </Button>
          )
        }
      />
      {q.isPending ? (
        <SkeletonRows rows={6} />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Cost of what is in use" value={inrCompact(cost)} icon={IndianRupee} hint={`${inUse.length} ${inUse.length === 1 ? "item" : "items"}`} />
            <StatCard
              label="Worth now"
              value={inrCompact(worth)}
              icon={TrendingDown}
              tone="info"
              hint={cost ? `${Math.round((1 - worth / cost) * 100)}% depreciated · ${inr(thisMonth)} this month` : "Nothing in the register yet"}
            />
            <StatCard
              label="Out now"
              value={out.length}
              icon={PackageOpen}
              tone={overdue ? "danger" : "accent"}
              hint={overdue ? `${overdue} overdue` : "On shoots and trips"}
            />
            <StatCard label="Out for repair" value={repairs} icon={Wrench} tone={repairs ? "warning" : "success"} hint={repairs ? "Not available" : "Everything in service"} />
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="register">
                <Boxes /> Register
              </TabsTrigger>
              <TabsTrigger value="reservations">
                <CalendarDays /> Reservations
              </TabsTrigger>
            </TabsList>
            <TabsContent value="register">
              <Register rows={rows} onOpen={setOpenId} onAdd={can("equipment", "approve") ? () => setAdding(true) : undefined} />
            </TabsContent>
            <TabsContent value="reservations">
              <Reservations onOpen={setOpenId} />
            </TabsContent>
          </Tabs>
        </div>
      )}
      {openId && <AssetPanel id={openId} onClose={() => setOpenId(null)} />}
      {adding && <AssetForm asset={null} onClose={() => setAdding(false)} onSaved={(a) => (setAdding(false), setOpenId(a.id))} />}
    </>
  );
}

function Register({ rows, onOpen, onAdd }: { rows: AssetRow[]; onOpen: (id: string) => void; onAdd?: () => void }) {
  const me = useMe().data;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("in_use");
  const [whose, setWhose] = useState("all");
  const s = search.trim().toLowerCase();
  const shown = rows.filter(
    (a) =>
      (category === "all" || a.category === category) &&
      (status === "all" || (status === "in_use" ? a.status !== "retired" : a.status === status)) &&
      (whose === "all" || a.out?.holder.id === me?.user.id) &&
      (!s || [a.tag, a.name, a.serialNo, a.out?.holder.name ?? ""].some((x) => x.toLowerCase().includes(s))),
  );
  if (!rows.length)
    return (
      <Card className="p-6">
        <EmptyState
          icon={Boxes}
          title="Nothing in the register yet"
          description="Add each camera, lens, light and computer with what it cost and how long it lasts. The register then works out what it is worth and what an hour of its use costs."
          action={
            onAdd && (
              <Button variant="accent" onClick={onAdd}>
                <Plus /> Add the first item
              </Button>
            )
          }
        />
      </Card>
    );
  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tag, item, serial number or who has it" aria-label="Search the register" className="pl-9" />
        </div>
        <Select
          className="md:w-40"
          value={category}
          onValueChange={setCategory}
          aria-label="Category"
          options={[{ value: "all", label: "All kinds" }, ...ASSET_CATEGORIES.map((c) => ({ value: c, label: c }))]}
        />
        <Select
          className="md:w-40"
          value={status}
          onValueChange={setStatus}
          aria-label="Status"
          options={[
            { value: "in_use", label: "In use" },
            { value: "all", label: "Everything" },
            ...ASSET_STATUSES.map((x) => ({ value: x, label: ASSET_STATUS_LABEL[x] })),
          ]}
        />
        <Select
          className="md:w-36"
          value={whose}
          onValueChange={setWhose}
          aria-label="Whose"
          options={[
            { value: "all", label: "Everyone's" },
            { value: "mine", label: "With me" },
          ]}
        />
      </div>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Tag</TH>
            <TH>Item</TH>
            <TH>Status</TH>
            <TH>Who has it</TH>
            <TH>Condition</TH>
            <TH numeric>Hours used</TH>
            <TH numeric>Worth now</TH>
            <TH numeric className="pr-5">
              An hour
            </TH>
          </TR>
        </THead>
        <TBody>
          {shown.map((a) => (
            <TR key={a.id} className="cursor-pointer" onClick={() => onOpen(a.id)}>
              <TD className="pl-5 font-mono text-body text-muted-foreground">{a.tag}</TD>
              <TD>
                <div className="font-medium">{a.name}</div>
                <div className="text-body text-muted-foreground">{a.category}</div>
              </TD>
              <TD>
                <Badge tone={STATUS_TONE[a.status]} dot>
                  {ASSET_STATUS_LABEL[a.status]}
                </Badge>
              </TD>
              <TD>
                {a.out ? (
                  <div>
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={a.out.holder.name ?? "?"} size="sm" />
                      <span className="whitespace-nowrap">{a.out.holder.name}</span>
                    </span>
                    {a.out.dueOn && (
                      <div className={cn("text-body", a.out.overdue ? "font-medium text-danger" : "text-muted-foreground")}>
                        {a.out.overdue ? "Overdue since" : "Due"} {fmtDate(a.out.dueOn)}
                      </div>
                    )}
                  </div>
                ) : a.nextReservation ? (
                  <span className="text-body text-muted-foreground">
                    Booked {fmtDate(a.nextReservation.date)} · {a.nextReservation.for.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{a.location || "In the equipment room"}</span>
                )}
              </TD>
              <TD>
                <Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge>
              </TD>
              <TD numeric>{a.hoursUsed ? a.hoursUsed.toLocaleString("en-IN") : <span className="text-muted-foreground">—</span>}</TD>
              <TD numeric>{inr(a.bookValue)}</TD>
              <TD numeric className="pr-5 font-medium">
                {a.perHour === null ? <span className="font-normal text-muted-foreground">—</span> : inr(a.perHour)}
              </TD>
            </TR>
          ))}
          {shown.length === 0 && (
            <TR className="hover:bg-transparent">
              <TD colSpan={8} className="px-5">
                <EmptyState compact icon={Boxes} title="Nothing matches" description="Try another search, kind or status." />
              </TD>
            </TR>
          )}
        </TBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-body text-muted-foreground">
        <span>
          Showing {shown.length} of {rows.length} · open an item for its depreciation, who had it, repairs and reservations
        </span>
        <span className="tabular">Worth now {inr(shown.reduce((n, a) => n + a.bookValue, 0))}</span>
      </div>
    </Card>
  );
}

function mayCancel(r: AssetReservationRow, me: string | undefined, approve: boolean) {
  return approve || r.for.id === me || r.createdBy?.id === me;
}

function Reservations({ onOpen }: { onOpen: (id: string) => void }) {
  const q = useAssetReservations();
  const me = useMe().data?.user.id;
  const can = useCan();
  const act = useAssetAction();
  if (q.isPending) return <SkeletonRows rows={4} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  if (!q.data.length)
    return (
      <Card className="p-6">
        <EmptyState icon={CalendarDays} title="No reservations ahead" description="Open an item in the register to book it for a day or a shoot." />
      </Card>
    );
  return (
    <div className="space-y-2">
      {q.data.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center gap-3 p-3.5">
          <DateBlock date={r.date} />
          <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => onOpen(r.asset.id)}>
            <div className="text-body font-medium">
              <span className="font-mono text-muted-foreground">{r.asset.tag}</span> {r.asset.name}
            </div>
            <div className="text-body text-muted-foreground">
              {r.shoot ? `${r.shoot.client} · ${r.shoot.title}` : r.purpose}
              {r.location ? ` · ${r.location}` : ""}
            </div>
          </button>
          <span className="inline-flex items-center gap-1.5 text-body">
            <Avatar name={r.for.name ?? "?"} size="xs" />
            {r.for.name}
          </span>
          {mayCancel(r, me, can("equipment", "approve")) && (
            <Button
              variant="ghost"
              size="sm"
              disabled={act.isPending}
              onClick={() => act.mutate({ step: "cancelReservation", reservationId: r.id }, { onSuccess: () => toast("Reservation cancelled"), onError })}
            >
              <X /> Cancel
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}

function DateBlock({ date }: { date: string }) {
  return (
    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-center leading-none">
      <span className="text-body uppercase text-muted-foreground">{fmtDate(date, { month: "short" })}</span>
      <span className="text-subheading font-semibold">{fmtDate(date, { day: "numeric" })}</span>
    </div>
  );
}

// ─── One item ─────────────────────────────────────────────────────────

type Action = "edit" | "checkOut" | "return" | "reserve" | "problem" | "maintenance" | "back" | "retire";

function AssetPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAsset(id);
  const [action, setAction] = useState<Action | null>(null);
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent side="right" className="max-w-2xl">
          {q.isPending ? (
            <div className="p-6">
              <DialogTitle className="sr-only">Loading</DialogTitle>
              <SkeletonRows rows={6} />
            </div>
          ) : q.error ? (
            <div className="p-6">
              <DialogTitle className="sr-only">Not found</DialogTitle>
              <Alert tone="danger">{errorMessage(q.error)}</Alert>
            </div>
          ) : (
            <AssetBody a={q.data} onAction={setAction} />
          )}
        </DialogContent>
      </Dialog>
      {q.data && action === "edit" && <AssetForm asset={q.data} onClose={() => setAction(null)} onSaved={() => setAction(null)} />}
      {q.data && action === "checkOut" && <CheckOutDialog a={q.data} onClose={() => setAction(null)} />}
      {q.data && action === "return" && <ReturnDialog a={q.data} onClose={() => setAction(null)} />}
      {q.data && action === "reserve" && <ReserveDialog a={q.data} onClose={() => setAction(null)} />}
      {q.data && action === "maintenance" && <MaintenanceDialog a={q.data} onClose={() => setAction(null)} />}
      {q.data && action === "back" && <BackInServiceDialog a={q.data} onClose={() => setAction(null)} />}
      {q.data && action === "problem" && (
        <NoteDialog
          title={`Report a problem with ${q.data.tag}`}
          label="What is wrong"
          hint="It is taken out of service until someone who keeps the register puts it back."
          button="Report it"
          onClose={() => setAction(null)}
          submit={(note) => ({ step: "problem", id: q.data.id, note })}
          done="Problem reported"
        />
      )}
      {q.data && action === "retire" && (
        <NoteDialog
          title={`Retire ${q.data.tag}?`}
          label="Why it is retired"
          hint="It stays in the register with its history, out of use. Its reservations are dropped."
          button="Retire it"
          onClose={() => setAction(null)}
          submit={(note) => ({ step: "retire", id: q.data.id, note })}
          done="Retired"
        />
      )}
    </>
  );
}

function bookValueSeries(a: AssetRow) {
  const months = a.usefulLifeYears * 12;
  const step = months > 24 ? 3 : 1;
  const [y, m, d] = a.purchaseDate.split("-").map(Number) as [number, number, number];
  return Array.from({ length: Math.floor(months / step) + 1 }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 + i * step, d)).toISOString().slice(0, 10);
    return { date, label: fmtDate(date, { month: "short", year: "2-digit" }), value: bookValueOn(a, date) };
  });
}

function AssetBody({ a, onAction }: { a: AssetDetail; onAction: (x: Action) => void }) {
  const can = useCan();
  const me = useMe().data?.user.id;
  const act = useAssetAction();
  const [today] = useState(() => dayFrom(0));
  const use = can("equipment", "edit");
  const keep = can("equipment", "approve");
  const live = a.status !== "retired";
  return (
    <div>
      <div className="border-b border-border p-4 pr-12 sm:p-6 sm:pr-12">
        <div className="flex flex-wrap items-center gap-2 text-body text-muted-foreground">
          <Badge tone="outline">{a.tag}</Badge>
          <span>{a.category}</span>
          {a.serialNo && <span>· Serial {a.serialNo}</span>}
        </div>
        <DialogTitle className="mt-2">{a.name}</DialogTitle>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[a.status]} dot>
            {ASSET_STATUS_LABEL[a.status]}
          </Badge>
          <Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge>
          {a.out && (
            <span className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
              <Avatar name={a.out.holder.name ?? "?"} size="xs" /> with {a.out.holder.name}
              {a.out.dueOn && (
                <span className={cn(a.out.overdue && "font-medium text-danger")}>
                  · {a.out.overdue ? "overdue since" : "due"} {fmtDate(a.out.dueOn)}
                </span>
              )}
            </span>
          )}
        </div>
        {a.openRepair && (
          <Alert tone="warning" className="mt-3">
            Out for repair since {longDate(a.openRepair.since)}: {a.openRepair.title}
          </Alert>
        )}
        {a.retiredAt && (
          <Alert tone="info" className="mt-3">
            Retired on {longDate(istDay(a.retiredAt))}: {a.retiredNote}
          </Alert>
        )}
        {live && (use || keep) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {use && !a.out && !a.openRepair && (
              <Button size="sm" variant="accent" onClick={() => onAction("checkOut")}>
                <ArrowUpRight /> Check out
              </Button>
            )}
            {use && a.out && (
              <Button size="sm" variant="accent" onClick={() => onAction("return")}>
                <Undo2 /> Take it back
              </Button>
            )}
            {use && a.out?.kind !== "assigned" && (
              <Button size="sm" variant="outline" onClick={() => onAction("reserve")}>
                <CalendarPlus /> Reserve
              </Button>
            )}
            {use && !a.openRepair && (
              <Button size="sm" variant="outline" onClick={() => onAction("problem")}>
                <TriangleAlert /> Report a problem
              </Button>
            )}
            {keep && a.openRepair && (
              <Button size="sm" variant="outline" onClick={() => onAction("back")}>
                <Wrench /> Back in service
              </Button>
            )}
            {keep && (
              <Button size="sm" variant="ghost" onClick={() => onAction("maintenance")}>
                <Wrench /> Log a service
              </Button>
            )}
            {keep && (
              <Button size="sm" variant="ghost" onClick={() => onAction("edit")}>
                <Pencil /> Change
              </Button>
            )}
            {keep && !a.out && (
              <Button size="sm" variant="ghost" onClick={() => onAction("retire")}>
                <Archive /> Retire
              </Button>
            )}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Bought" value={inr(a.purchaseValue)} sub={longDate(a.purchaseDate)} />
          <Metric label="Worth now" value={inr(a.bookValue)} sub={`At the end ${inr(a.residualValue)}`} />
          <Metric label="Depreciation a year" value={inr(annualDepreciation(a))} sub={`Over ${a.usefulLifeYears} ${a.usefulLifeYears === 1 ? "year" : "years"}`} />
          <Metric
            label="An hour's use"
            value={a.perHour === null ? "—" : inr(a.perHour)}
            sub={a.hoursPerYear ? `${a.hoursPerYear.toLocaleString("en-IN")} hours a year` : "Not costed by the hour"}
          />
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="overview">
          <TabsList className="scrollbar-thin max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">
              <LayoutGrid /> Depreciation
            </TabsTrigger>
            <TabsTrigger value="custody">
              <History /> Who had it
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Wrench /> Repairs
            </TabsTrigger>
            <TabsTrigger value="reservations">
              <CalendarDays /> Reservations
              {a.reservations.length > 0 && (
                <Badge tone="accent" className="tabular px-1.5">
                  {a.reservations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center justify-between text-body">
                <span className="font-medium">Worth over its useful life</span>
                <span className="text-muted-foreground">Straight line</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bookValueSeries(a)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-chart-grid)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} tickFormatter={(v: number) => inrCompact(v)} />
                    <RTooltip
                      contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 13, padding: "8px 10px" }}
                      formatter={(v) => [inr(Number(v)), "Worth"]}
                    />
                    <Area type="linear" dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2} fill="var(--color-chart-1)" fillOpacity={0.08} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <THead>
                  <TR>
                    <TH>Year</TH>
                    <TH>From</TH>
                    <TH numeric>Opening</TH>
                    <TH numeric>Depreciation</TH>
                    <TH numeric>Closing</TH>
                  </TR>
                </THead>
                <TBody>
                  {depreciationSchedule(a, today).map((y) => (
                    <TR key={y.year} className={cn(y.current && "bg-primary-soft/50")}>
                      <TD className="font-medium">
                        {y.year} {y.current && <Badge tone="accent">Now</Badge>}
                      </TD>
                      <TD className="text-muted-foreground">{fmtDate(y.from, { month: "short", year: "numeric" })}</TD>
                      <TD numeric>{inr(y.opening)}</TD>
                      <TD numeric className="text-danger">
                        −{inr(y.depreciation)}
                      </TD>
                      <TD numeric className="font-medium">
                        {inr(y.closing)}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label="Hours used" value={`${a.hoursUsed.toLocaleString("en-IN")} h`} sub="Recorded when it comes back" />
              <Metric label="Carried by shoots" value={a.recovered === null ? "—" : inr(a.recovered)} sub="Hours used at its cost an hour" />
            </div>
          </TabsContent>

          <TabsContent value="custody">
            {a.custody.length === 0 ? (
              <EmptyState compact icon={History} title="Nobody has had it yet" description="Each check-out and return shows here." />
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-5">
                {a.custody.map((c) => (
                  <li key={c.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[31px] top-0 inline-flex size-5 items-center justify-center rounded-full ring-4 ring-popover",
                        c.returnedAt ? "bg-success-soft text-success" : c.kind === "assigned" ? "bg-info-soft text-info" : "bg-primary-soft text-primary",
                      )}
                    >
                      {c.returnedAt ? <ArrowDownLeft className="size-3" /> : c.kind === "assigned" ? <UserCheck className="size-3" /> : <ArrowUpRight className="size-3" />}
                    </span>
                    <div className="text-body">
                      <span className="font-medium">
                        {c.kind === "assigned" ? "Assigned to" : "Checked out to"} {c.holder.name}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        · {when(c.outAt)}
                        {c.outBy && c.outBy.id !== c.holder.id ? ` by ${c.outBy.name}` : ""}
                      </span>
                    </div>
                    <div className="text-body text-muted-foreground">
                      {c.shoot ? `${c.shoot.client} · ${c.shoot.title} (${fmtDate(c.shoot.date)})` : c.purpose || "—"}
                      {c.dueOn ? ` · due ${fmtDate(c.dueOn)}` : ""}
                    </div>
                    {c.note && <div className="text-body text-muted-foreground">{c.note}</div>}
                    {c.returnedAt && (
                      <div className="mt-1 text-body">
                        Back {when(c.returnedAt)}
                        {c.returnedTo ? ` to ${c.returnedTo.name}` : ""} · {c.returnCondition}
                        {c.hours !== null ? ` · ${c.hours} h of use` : ""}
                        {c.returnNote ? ` · ${c.returnNote}` : ""}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-2">
            {a.maintenance.length === 0 && <EmptyState compact icon={Wrench} title="No services or repairs" description="Problems reported and services logged show here." />}
            {a.maintenance.map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-3.5">
                <div className="min-w-0">
                  <div className="text-body font-medium">
                    {m.title}{" "}
                    {m.outOfService && !m.closedAt && (
                      <Badge tone="warning" className="ml-1">
                        Out of service
                      </Badge>
                    )}
                  </div>
                  <div className="text-body text-muted-foreground">
                    {longDate(m.date)}
                    {m.by ? ` · ${m.by}` : ""}
                    {m.closedAt ? ` · back in service ${fmtDate(istDay(m.closedAt))}, ${m.closeCondition}` : ""}
                  </div>
                  {m.note && <div className="whitespace-pre-line text-body text-muted-foreground">{m.note}</div>}
                </div>
                <span className="shrink-0 text-body tabular">{m.cost ? inr(m.cost) : <span className="text-muted-foreground">No cost</span>}</span>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reservations" className="space-y-2">
            {a.reservations.length === 0 && <EmptyState compact icon={CalendarDays} title="No reservations ahead" description="Book it for a day or a shoot." />}
            {a.reservations.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5">
                <DateBlock date={r.date} />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-medium">{r.shoot ? `${r.shoot.client} · ${r.shoot.title}` : r.purpose}</div>
                  <div className="text-body text-muted-foreground">
                    For {r.for.name}
                    {r.location ? ` · ${r.location}` : ""}
                  </div>
                </div>
                {mayCancel(r, me, keep) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ step: "cancelReservation", reservationId: r.id }, { onSuccess: () => toast("Reservation cancelled"), onError })}
                  >
                    <X /> Cancel
                  </Button>
                )}
              </div>
            ))}
            {use && live && a.out?.kind !== "assigned" && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => onAction("reserve")}>
                <CalendarPlus /> Reserve it
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-body font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-subheading font-semibold tabular">{value}</div>
      {sub && <div className="mt-0.5 text-body text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Forms ────────────────────────────────────────────────────────────

const numberOr = (v: string, or: number) => (v.trim() === "" ? or : Number(v));

function AssetForm({ asset, onClose, onSaved }: { asset: AssetDetail | null; onClose: () => void; onSaved: (a: AssetDetail) => void }) {
  const act = useAssetAction();
  const [today] = useState(() => dayFrom(0));
  const [f, setF] = useState({
    tag: asset?.tag ?? "",
    name: asset?.name ?? "",
    category: (asset?.category ?? "Camera") as AssetCategory,
    serialNo: asset?.serialNo ?? "",
    purchaseDate: asset?.purchaseDate ?? today,
    purchaseValue: asset ? String(asset.purchaseValue) : "",
    residualValue: asset ? String(asset.residualValue) : "0",
    usefulLifeYears: asset ? String(asset.usefulLifeYears) : "4",
    hoursPerYear: asset ? (asset.hoursPerYear === null ? "" : String(asset.hoursPerYear)) : String(defaultHoursPerYear("Camera") ?? ""),
    condition: (asset?.condition ?? "Good") as AssetCondition,
    location: asset?.location ?? "",
    notes: asset?.notes ?? "",
  });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{asset ? `Change ${asset.tag}` : "Add an item to the register"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Tag" hint="Its own label, such as GM-CAM-01">
            <Input value={f.tag} onChange={(e) => set({ tag: e.target.value })} />
          </Field>
          <Field label="Kind">
            <Select
              value={f.category}
              onValueChange={(v) => set({ category: v as AssetCategory, hoursPerYear: String(defaultHoursPerYear(v as AssetCategory) ?? "") })}
              options={ASSET_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Item" className="sm:col-span-2">
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Sony A7 IV body" />
          </Field>
          <Field label="Serial number">
            <Input value={f.serialNo} onChange={(e) => set({ serialNo: e.target.value })} />
          </Field>
          <Field label="Bought on">
            <Input type="date" value={f.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} />
          </Field>
          <Field label="What it cost (₹)">
            <Input inputMode="numeric" value={f.purchaseValue} onChange={(e) => set({ purchaseValue: e.target.value })} />
          </Field>
          <Field label="Worth at the end (₹)">
            <Input inputMode="numeric" value={f.residualValue} onChange={(e) => set({ residualValue: e.target.value })} />
          </Field>
          <Field label="Useful life (years)">
            <Input inputMode="numeric" value={f.usefulLifeYears} onChange={(e) => set({ usefulLifeYears: e.target.value })} />
          </Field>
          <Field label="Hours of use a year" hint="Empty when it is not costed by the hour">
            <Input inputMode="numeric" value={f.hoursPerYear} onChange={(e) => set({ hoursPerYear: e.target.value })} />
          </Field>
          <Field label="Condition">
            <Select value={f.condition} onValueChange={(v) => set({ condition: v as AssetCondition })} options={ASSET_CONDITIONS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Kept at">
            <Input value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="Equipment room" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || !f.tag.trim() || f.name.trim().length < 2 || !f.purchaseValue}
            onClick={() =>
              act.mutate(
                {
                  step: "save",
                  id: asset?.id,
                  body: {
                    ...f,
                    purchaseValue: numberOr(f.purchaseValue, 0),
                    residualValue: numberOr(f.residualValue, 0),
                    usefulLifeYears: numberOr(f.usefulLifeYears, 1),
                    hoursPerYear: f.hoursPerYear.trim() === "" ? null : Number(f.hoursPerYear),
                  },
                },
                { onSuccess: (a) => (toast.success(asset ? "Saved" : `${a.tag} added`), onSaved(a)), onError },
              )
            }
          >
            {asset ? "Save" : "Add it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Who and which shoot, for check-out and reservations. */
function usePickers() {
  const people = useAssetPeople();
  const shoots = useAssetShoots();
  return {
    people: (people.data ?? []).map((p) => ({ value: p.id, label: p.name ?? "—" })),
    shoots: [
      { value: "_none", label: "Not for a shoot" },
      ...(shoots.data ?? []).map((s) => ({ value: s.id, label: `${fmtDate(s.date)} · ${s.client} · ${s.title}` })),
    ],
    shootDate: (id: string) => shoots.data?.find((s) => s.id === id)?.date,
  };
}

function CheckOutDialog({ a, onClose }: { a: AssetDetail; onClose: () => void }) {
  const act = useAssetAction();
  const me = useMe().data?.user.id ?? "";
  const p = usePickers();
  const [f, setF] = useState({ kind: "out" as "out" | "assigned", userId: me, shootId: "_none", purpose: "", dueOn: "", note: "" });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const forShoot = f.kind === "out" && f.shootId !== "_none";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Check out {a.tag} {a.name}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="How">
            <Select
              value={f.kind}
              onValueChange={(v) => set({ kind: v as "out" | "assigned" })}
              options={[
                { value: "out", label: "For a while (a shoot, a trip)" },
                { value: "assigned", label: "Assigned for good (a desk)" },
              ]}
            />
          </Field>
          <Field label="To">
            <Select value={f.userId} onValueChange={(v) => set({ userId: v })} options={p.people} placeholder="Choose the person" />
          </Field>
          {f.kind === "out" && (
            <Field label="For the shoot" className="sm:col-span-2">
              <Select value={f.shootId} onValueChange={(v) => set({ shootId: v })} options={p.shoots} />
            </Field>
          )}
          <Field label={forShoot ? "Purpose (the shoot's title if empty)" : "What it is for"} className="sm:col-span-2">
            <Input value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} />
          </Field>
          {f.kind === "out" && (
            <Field label="Due back" hint={forShoot ? "The shoot's day if empty" : undefined}>
              <Input type="date" value={f.dueOn} onChange={(e) => set({ dueOn: e.target.value })} />
            </Field>
          )}
          <Field label="Note" className={f.kind === "out" ? "" : "sm:col-span-2"}>
            <Input value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Batteries, cards, bag" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || !f.userId || (f.kind === "out" && !forShoot && !f.purpose.trim())}
            onClick={() =>
              act.mutate(
                {
                  step: "checkOut",
                  id: a.id,
                  body: {
                    kind: f.kind,
                    userId: f.userId,
                    shootId: forShoot ? f.shootId : null,
                    purpose: f.purpose,
                    dueOn: f.kind === "out" && f.dueOn ? f.dueOn : null,
                    note: f.note,
                  },
                },
                { onSuccess: () => (toast.success(f.kind === "assigned" ? "Assigned" : "Checked out"), onClose()), onError },
              )
            }
          >
            {f.kind === "assigned" ? "Assign it" : "Check it out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ a, onClose }: { a: AssetDetail; onClose: () => void }) {
  const act = useAssetAction();
  const [f, setF] = useState({ condition: (a.condition === "Needs repair" ? "Good" : a.condition) as AssetCondition, hours: "", note: "" });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const broken = f.condition === "Needs repair";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Take back {a.tag} from {a.out?.holder.name}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Condition">
            <Select value={f.condition} onValueChange={(v) => set({ condition: v as AssetCondition })} options={ASSET_CONDITIONS.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Hours of use" hint={a.perHour ? `At ${inr(a.perHour)} an hour` : undefined}>
            <Input inputMode="decimal" value={f.hours} onChange={(e) => set({ hours: e.target.value })} placeholder={a.out?.shoot ? "Hours it was shooting" : ""} />
          </Field>
          <Field label={broken ? "What is wrong" : "Note"} className="sm:col-span-2">
            <Input value={f.note} onChange={(e) => set({ note: e.target.value })} />
          </Field>
          {broken && <p className="text-body text-muted-foreground sm:col-span-2">It goes out for repair until someone who keeps the register puts it back in service.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || (broken && !f.note.trim())}
            onClick={() =>
              act.mutate(
                { step: "return", id: a.id, body: { condition: f.condition, hours: f.hours.trim() === "" ? null : Number(f.hours), note: f.note } },
                { onSuccess: () => (toast.success("Back in the equipment room"), onClose()), onError },
              )
            }
          >
            Take it back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReserveDialog({ a, onClose }: { a: AssetDetail; onClose: () => void }) {
  const act = useAssetAction();
  const me = useMe().data?.user.id ?? "";
  const p = usePickers();
  const [f, setF] = useState(() => ({ date: dayFrom(1), userId: me, shootId: "_none", purpose: "", location: "" }));
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const forShoot = f.shootId !== "_none";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Reserve {a.tag} {a.name}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="For the shoot" className="sm:col-span-2">
            <Select value={f.shootId} onValueChange={(v) => set({ shootId: v, ...(v !== "_none" && p.shootDate(v) ? { date: p.shootDate(v)! } : {}) })} options={p.shoots} />
          </Field>
          <Field label="Day">
            <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="For">
            <Select value={f.userId} onValueChange={(v) => set({ userId: v })} options={p.people} placeholder="Choose the person" />
          </Field>
          <Field label={forShoot ? "Purpose (the shoot's title if empty)" : "What it is for"} className="sm:col-span-2">
            <Input value={f.purpose} onChange={(e) => set({ purpose: e.target.value })} />
          </Field>
          <Field label="Where" className="sm:col-span-2">
            <Input value={f.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || !f.userId || !f.date || (!forShoot && !f.purpose.trim())}
            onClick={() =>
              act.mutate(
                { step: "reserve", id: a.id, body: { ...f, shootId: forShoot ? f.shootId : null } },
                { onSuccess: () => (toast.success(`Reserved for ${fmtDate(f.date)}`), onClose()), onError },
              )
            }
          >
            Reserve it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MaintenanceDialog({ a, onClose }: { a: AssetDetail; onClose: () => void }) {
  const act = useAssetAction();
  const [f, setF] = useState(() => ({ date: dayFrom(0), title: "", by: "", cost: "", note: "", outOfService: "no" }));
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Log a service or repair for {a.tag}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="What was done" className="sm:col-span-2">
            <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="Sensor cleaning" />
          </Field>
          <Field label="On">
            <Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          <Field label="By">
            <Input value={f.by} onChange={(e) => set({ by: e.target.value })} placeholder="Service centre or person" />
          </Field>
          <Field label="Cost (₹)">
            <Input inputMode="numeric" value={f.cost} onChange={(e) => set({ cost: e.target.value })} />
          </Field>
          <Field label="Meanwhile">
            <Select
              value={f.outOfService}
              onValueChange={(v) => set({ outOfService: v })}
              disabled={!!a.openRepair || a.out?.kind === "out"}
              options={[
                { value: "no", label: "It stays in service" },
                { value: "yes", label: "Out of service until it is back" },
              ]}
            />
          </Field>
          <Field label="Note" className="sm:col-span-2">
            <Textarea rows={2} value={f.note} onChange={(e) => set({ note: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || f.title.trim().length < 2}
            onClick={() =>
              act.mutate(
                {
                  step: "maintenance",
                  id: a.id,
                  body: { date: f.date, title: f.title, by: f.by, cost: numberOr(f.cost, 0), note: f.note, outOfService: f.outOfService === "yes" },
                },
                { onSuccess: () => (toast.success("Logged"), onClose()), onError },
              )
            }
          >
            Log it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BackInServiceDialog({ a, onClose }: { a: AssetDetail; onClose: () => void }) {
  const act = useAssetAction();
  const [f, setF] = useState({ condition: "Good" as "Excellent" | "Good" | "Fair", cost: "", note: "" });
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Put {a.tag} back in service</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <p className="text-body text-muted-foreground sm:col-span-2">{a.openRepair?.title}</p>
          <Field label="Condition now">
            <Select
              value={f.condition}
              onValueChange={(v) => set({ condition: v as typeof f.condition })}
              options={["Excellent", "Good", "Fair"].map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="What the repair cost (₹)">
            <Input inputMode="numeric" value={f.cost} onChange={(e) => set({ cost: e.target.value })} />
          </Field>
          <Field label="What was done" className="sm:col-span-2">
            <Input value={f.note} onChange={(e) => set({ note: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || !a.openRepair}
            onClick={() =>
              act.mutate(
                { step: "backInService", maintenanceId: a.openRepair!.id, body: { condition: f.condition, cost: f.cost.trim() === "" ? null : Number(f.cost), note: f.note } },
                { onSuccess: () => (toast.success("Back in service"), onClose()), onError },
              )
            }
          >
            Back in service
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({
  title,
  label,
  hint,
  button,
  done,
  submit,
  onClose,
}: {
  title: string;
  label: string;
  hint: string;
  button: string;
  done: string;
  submit: (note: string) => Parameters<ReturnType<typeof useAssetAction>["mutate"]>[0];
  onClose: () => void;
}) {
  const act = useAssetAction();
  const [note, setNote] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label={label}>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <p className="text-body text-muted-foreground">{hint}</p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || note.trim().length < 3}
            onClick={() => act.mutate(submit(note), { onSuccess: () => (toast.success(done), onClose()), onError })}
          >
            {button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
