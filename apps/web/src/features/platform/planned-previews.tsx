"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  RefreshCw,
  Sparkles,
  Wifi,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, inrCompact } from "@/lib/utils";

// ───────────────────────── Business diagnostic ─────────────────────────

const FUNCTIONS = ["Marketing", "Sales", "Operations", "R&D", "Accounts & Finance", "HR", "Management"];
const DIMS = ["Action consistency", "Owner dependency", "Results efficiency"];
const bfa: number[][] = [
  [3, 4, 3],
  [2, 5, 3],
  [4, 3, 4],
  [2, 4, 2],
  [3, 4, 3],
  [3, 2, 3],
  [2, 5, 3],
];

export function DiagnosticPreview() {
  const [sel, setSel] = useState<[number, number] | null>([1, 1]);
  // Owner dependency is "bad when high" — shown on its own scale.
  const fdi = Math.round((bfa.reduce((s, r) => s + r[1], 0) / (bfa.length * 5)) * 100);
  const cell = (v: number, dim: number) => {
    const good = dim === 1 ? 6 - v : v;
    return good >= 4 ? "bg-success-soft text-success" : good === 3 ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger";
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-body">
          <thead>
            <tr>
              <th className="pb-2 text-left font-medium text-muted-foreground">Function</th>
              {DIMS.map((d) => (
                <th key={d} className="pb-2 text-center font-medium text-muted-foreground">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FUNCTIONS.map((f, i) => (
              <tr key={f}>
                <td className="py-1 pr-3 font-medium">{f}</td>
                {bfa[i].map((v, j) => (
                  <td key={j} className="p-1">
                    <button
                      onClick={() => setSel([i, j])}
                      className={cn(
                        "h-8 w-full cursor-pointer rounded-md text-body font-semibold tabular transition",
                        cell(v, j),
                        sel && sel[0] === i && sel[1] === j && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                      )}
                    >
                      {v}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sel && (
          <div className="mt-3 rounded-xl bg-muted/60 p-3 text-body">
            <span className="font-medium">
              {FUNCTIONS[sel[0]]} · {DIMS[sel[1]]}: {bfa[sel[0]][sel[1]]}/5.
            </span>{" "}
            <span className="text-muted-foreground">
              {sel[1] === 1
                ? "High owner dependency — decisions and client calls still route through the founder. Suggest: document the decision rules and delegate to the manager."
                : "Evidence pulled from SOP compliance, cycle delivery and review outcomes. Founder confirms or overrides the score with a note."}
            </span>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-border p-4 text-center">
        <div className="text-body font-semibold uppercase tracking-wider text-muted-foreground">Founder-dependency index</div>
        <div className="mt-3 text-heading font-semibold leading-none tabular text-warning">{fdi}</div>
        <div className="text-body text-muted-foreground">out of 100 · lower is better</div>
        <div className="mt-4 space-y-1.5 text-left text-body">
          {["Sales closes need founder", "Client escalations", "Discount approvals"].map((x, i) => (
            <div key={x} className="flex items-center justify-between">
              <span className="text-muted-foreground">{x}</span>
              <span className="font-medium tabular">{[82, 64, 100][i]}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Scenario planner ─────────────────────────

export function ScenarioPreview() {
  const [clients, setClients] = useState(2);
  const [price, setPrice] = useState(5);
  const [hire, setHire] = useState(true);
  const [outsource, setOutsource] = useState(15);

  const baseRev = 268000;
  const baseCost = 191000;
  const perClient = 52000;
  const rev = (baseRev + clients * perClient) * (1 + price / 100);
  const editorCost = hire ? 18000 : 0;
  const outsourceCost = (clients * perClient * 0.22 + baseRev * 0.05) * (outsource / 100) * 2.2;
  const cost = baseCost + clients * perClient * 0.42 + editorCost + outsourceCost;
  const margin = rev - cost;
  const baseMargin = baseRev - baseCost;
  const editorUtil = Math.min(140, 104 + clients * 9 - (hire ? 34 : 0) - outsource * 0.5);

  const sliders = [
    { label: "New clients", value: clients, set: setClients, min: 0, max: 6, step: 1, fmt: (v: number) => `+${v}` },
    { label: "Price change", value: price, set: setPrice, min: -10, max: 20, step: 1, fmt: (v: number) => `${v > 0 ? "+" : ""}${v}%` },
    { label: "Outsourced edits", value: outsource, set: setOutsource, min: 0, max: 50, step: 5, fmt: (v: number) => `${v}%` },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {sliders.map((s) => (
          <div key={s.label}>
            <div className="flex items-center justify-between text-body">
              <span className="font-medium">{s.label}</span>
              <span className="font-semibold tabular">{s.fmt(s.value)}</span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => s.set(Number(e.target.value))} className="mt-1 w-full cursor-pointer accent-[var(--color-primary)]" />
          </div>
        ))}
        <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-body">
          <span className="font-medium">Hire one more editor (₹38,000/mo)</span>
          <Switch checked={hire} onCheckedChange={setHire} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Monthly revenue", value: inrCompact(rev), delta: rev / baseRev - 1 },
          { label: "Monthly cost", value: inrCompact(cost), delta: cost / baseCost - 1, invert: true },
          { label: "Contribution margin", value: inrCompact(margin), delta: margin / baseMargin - 1 },
          { label: "Editor utilisation", value: `${Math.round(editorUtil)}%`, warn: editorUtil > 100 },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border p-3">
            <div className="text-body text-muted-foreground">{k.label}</div>
            <div className={cn("mt-1 text-heading font-semibold tabular", k.warn && "text-danger")}>{k.value}</div>
            {k.delta !== undefined && (
              <div className={cn("text-body font-medium tabular", (k.invert ? -k.delta : k.delta) >= 0 ? "text-success" : "text-danger")}>
                {k.delta >= 0 ? "+" : ""}
                {(k.delta * 100).toFixed(0)}% vs today
              </div>
            )}
            {k.warn && <div className="text-body text-danger">Overloaded — hire or outsource</div>}
          </div>
        ))}
        <div className="col-span-2 text-body text-muted-foreground">Illustrative only — the real model will use true costing, capacity and agreements.</div>
      </div>
    </div>
  );
}

// ───────────────────────── Peer feedback ─────────────────────────

export function PeerFeedbackPreview() {
  const [anon, setAnon] = useState(true);
  const [rating, setRating] = useState<number | null>(4);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-border p-4">
        <div className="flex items-center gap-2">
          <Avatar name="Surya Prakash" size="md" />
          <div>
            <div className="text-body font-medium">Feedback for Surya Prakash</div>
            <div className="text-body text-muted-foreground">45-day cycle · closes 30 Sep</div>
          </div>
        </div>
        <div className="mt-4 text-body font-medium">Hands off work that is ready to use, without rework</div>
        <div className="mt-2 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={cn("size-8 cursor-pointer rounded-lg border text-body font-semibold tabular transition", rating === n ? "border-primary bg-primary text-white" : "border-border hover:bg-muted")}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-muted/60 p-2.5 text-body text-muted-foreground">Give one specific example from the last 45 days…</div>
        <div className="mt-3 flex items-center justify-between text-body">
          <span className="inline-flex items-center gap-1.5">
            {anon ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {anon ? "Anonymous to Surya" : "Name visible to Surya"}
          </span>
          <Switch checked={anon} onCheckedChange={setAnon} />
        </div>
      </div>
      <div className="space-y-2">
        {[
          { t: "Collect", d: "Peers answer 5 structured prompts · 5 days", done: true },
          { t: "Minimum 3 responses", d: "Below 3, nothing is released (protects anonymity)", done: true },
          { t: "HR moderation", d: "Harini reviews wording; personal remarks removed", done: false },
          { t: "Release in 45-day review", d: "Shared by manager with a development plan", done: false },
        ].map((s, i) => (
          <div key={s.t} className="flex gap-3 rounded-xl border border-border p-3">
            <span className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-full text-body font-semibold", s.done ? "bg-success text-white" : "bg-muted text-muted-foreground")}>
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div>
              <div className="text-body font-medium">{s.t}</div>
              <div className="text-body text-muted-foreground">{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── AI assistant ─────────────────────────

const recs = [
  {
    id: "r1",
    title: "Move KVR-0926-07 to Surya — Divya is at 108% this week",
    evidence: ["Divya: 43.2 h logged vs 40 h capacity", "Surya: 30.1 h, same skills (Reels, Premiere)", "Due 29 Sep · priority"],
    scope: "Visible to: Founder, Manager",
  },
  {
    id: "r2",
    title: "Send a renewal proposal to Sri Lakshmi Silks",
    evidence: ["Agreement ends 31 Oct", "Health 78 · Breadwinning", "Delivered 96% of units over 12 months"],
    scope: "Visible to: Founder, Sales",
  },
  {
    id: "r3",
    title: "Chase invoice GM/26-27/041 — Urban Nest, 32 days overdue",
    evidence: ["₹40,000 outstanding", "2 reminders sent (day 7, day 15)", "Client response time avg 4 days"],
    scope: "Visible to: Founder, Finance",
  },
];

export function AiPreview() {
  const [state, setState] = useState<Record<string, "approved" | "dismissed">>({});
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {recs.map((r) => (
          <motion.div key={r.id} layout className={cn("rounded-2xl border p-4 transition", state[r.id] ? "border-border bg-muted/40" : "border-primary/25 bg-primary-soft/30")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Sparkles className="size-3.5" />
                </span>
                <div>
                  <div className={cn("text-body font-medium", state[r.id] === "dismissed" && "text-muted-foreground line-through")}>{r.title}</div>
                  <ul className="mt-1.5 space-y-0.5 text-body text-muted-foreground">
                    {r.evidence.map((e) => (
                      <li key={e} className="flex items-center gap-1.5">
                        <span className="size-1 rounded-full bg-muted-foreground/60" /> {e}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 text-body text-muted-foreground">{r.scope}</div>
                </div>
              </div>
              {state[r.id] ? (
                <Badge tone={state[r.id] === "approved" ? "success" : "neutral"}>{state[r.id] === "approved" ? "Approved · task created" : "Dismissed"}</Badge>
              ) : (
                <div className="flex gap-1.5">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      setState((s) => ({ ...s, [r.id]: "dismissed" }));
                      toast("Dismissed — the assistant learns from this");
                    }}
                  >
                    <X /> Dismiss
                  </Button>
                  <Button
                    size="xs"
                    variant="accent"
                    onClick={() => {
                      setState((s) => ({ ...s, [r.id]: "approved" }));
                      toast.success("Approved — nothing changes until a human says so");
                    }}
                  >
                    <Check /> Approve
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex items-center gap-2 text-body text-muted-foreground">
        <Bot className="size-3.5" /> The assistant only reads records your role can see, and never acts without approval.
      </div>
    </div>
  );
}

// ───────────────────────── Automation ─────────────────────────

const rules = [
  { trigger: "Deal marked Won", action: "Create client, agreement draft & onboarding checklist", runs: 14, status: "ok" },
  { trigger: "1st of month · active agreement", action: "Generate cycle with units, videos & due dates", runs: 30, status: "ok" },
  { trigger: "Kit checked out > 24 hrs", action: "Remind custodian → escalate to manager", runs: 9, status: "ok" },
  { trigger: "Video past due date", action: "Flag overdue, notify owner & manager", runs: 21, status: "warn" },
  { trigger: "Invoice 30 days overdue", action: "Create founder follow-up task", runs: 3, status: "ok" },
];

export function AutomationPreview() {
  const [queue, setQueue] = useState([
    { id: "x1", text: "Cycle generation — Nova Dental Oct 2026: agreement has no approver", tries: 3 },
    { id: "x2", text: "WhatsApp reminder to Gokul Das failed — number not on WhatsApp", tries: 2 },
  ]);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="divide-y divide-border rounded-2xl border border-border">
        {rules.map((r) => (
          <div key={r.trigger} className="flex items-center gap-3 px-4 py-3 text-body">
            <span className={cn("size-2 shrink-0 rounded-full", r.status === "ok" ? "bg-success" : "bg-warning")} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">{r.trigger}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{r.action}</span>
              </div>
            </div>
            <span className="shrink-0 text-body text-muted-foreground tabular">{r.runs} runs</span>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="text-body font-semibold">Exception queue</div>
          <Badge tone={queue.length ? "danger" : "success"}>{queue.length} open</Badge>
        </div>
        <div className="mt-3 space-y-2">
          {queue.length === 0 && <div className="py-6 text-center text-body text-muted-foreground">All clear</div>}
          {queue.map((q) => (
            <div key={q.id} className="rounded-xl bg-muted/60 p-3 text-body">
              <div>{q.text}</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-body text-muted-foreground">{q.tries} attempts · idempotent retry</span>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setQueue((x) => x.filter((y) => y.id !== q.id));
                    toast.success("Retried successfully", { description: "Same run key — no duplicate records created" });
                  }}
                >
                  <RefreshCw /> Retry
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Integrations ─────────────────────────

const integrations = [
  { name: "Google Workspace", desc: "Sign-in & user directory" },
  { name: "Google Calendar", desc: "Shoots, reviews, leave" },
  { name: "Google Drive", desc: "Footage & file links" },
  { name: "Meta (Instagram, Facebook)", desc: "Lead ads, post insights" },
  { name: "YouTube", desc: "Publishing proof & views" },
  { name: "WhatsApp Business", desc: "Reminders & client approvals" },
  { name: "Company LMS / community", desc: "Training progress" },
  { name: "Hikvision attendance", desc: "Punch data import" },
  { name: "Email (SMTP)", desc: "Invoices & notifications" },
  { name: "Webhooks", desc: "Send events to any tool" },
];

export function IntegrationsPreview() {
  const [watch, setWatch] = useState<Record<string, boolean>>({ "WhatsApp Business": true, "Hikvision attendance": true });
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {integrations.map((i) => (
        <div key={i.name} className="flex flex-col rounded-2xl border border-border p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-muted text-body font-semibold text-muted-foreground">
              {i.name
                .split(/[\s/(]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>
            <Badge>Planned</Badge>
          </div>
          <div className="mt-3 text-body font-medium leading-tight">{i.name}</div>
          <div className="mt-0.5 flex-1 text-body text-muted-foreground">{i.desc}</div>
          <button
            onClick={() => {
              setWatch((w) => ({ ...w, [i.name]: !w[i.name] }));
              toast.success(watch[i.name] ? "Removed from priority list" : `${i.name} marked as priority`);
            }}
            className={cn(
              "mt-3 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-1 text-body font-medium transition",
              watch[i.name] ? "border-primary/30 bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Bell className="size-3.5" /> {watch[i.name] ? "Priority" : "Mark priority"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────── Offline field app ─────────────────────────

export function OfflinePreview() {
  const [online, setOnline] = useState(false);
  const [items, setItems] = useState([
    { t: "Camera (2)", done: true },
    { t: "Batteries (2)", done: true },
    { t: "Camera Memory Card — empty (3)", done: false },
    { t: "Mic Box", done: false },
    { t: "Soft Box (2)", done: true },
  ]);
  const [conflict, setConflict] = useState(true);
  const pending = items.filter((i) => i.done).length;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
      <div className="mx-auto w-[260px] rounded-[28px] border-[6px] border-foreground/90 bg-card p-3 shadow-pop">
        <div className="flex items-center justify-between px-1 text-body">
          <span className="font-medium">Kaveri — shoot kit</span>
          <button onClick={() => setOnline(!online)} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 font-medium", online ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
            {online ? <Wifi className="size-3" /> : <CloudOff className="size-3" />}
            {online ? "Synced" : "Offline"}
          </button>
        </div>
        <div className="mt-3 space-y-1.5">
          {items.map((i, idx) => (
            <button
              key={i.t}
              onClick={() => setItems((x) => x.map((y, j) => (j === idx ? { ...y, done: !y.done } : y)))}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-left text-body"
            >
              <CheckCircle2 className={cn("size-4", i.done ? "text-success" : "text-muted-foreground/40")} />
              {i.t}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-muted px-2.5 py-1.5 text-center text-body text-muted-foreground">
          {online ? "All changes synced" : `${pending} changes queued · will sync on signal`}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-body text-muted-foreground">Tap the status pill to go online. Queued ticks sync in order; if someone changed the same item meanwhile, you review the conflict.</p>
        {conflict ? (
          <div className="rounded-2xl border border-warning/30 bg-warning-soft/50 p-4">
            <div className="text-body font-semibold">Sync conflict · Mic Box</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-body">
              <div className="rounded-lg bg-card p-2.5">
                <div className="text-body text-muted-foreground">On this phone · 10:42</div>Not packed — needs new battery
              </div>
              <div className="rounded-lg bg-card p-2.5">
                <div className="text-body text-muted-foreground">Office (Naveen) · 10:47</div>Packed — spare battery added
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="xs" variant="outline" onClick={() => { setConflict(false); toast.success("Kept phone version"); }}>
                Keep mine
              </Button>
              <Button size="xs" variant="accent" onClick={() => { setConflict(false); toast.success("Kept office version"); }}>
                Keep office
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-success/30 bg-success-soft/50 p-4 text-body text-success">Conflict resolved — audit log records both versions.</div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Audit log ─────────────────────────

const audit = [
  { actor: "Ashwin", at: "25 Sep · 09:41", action: "Changed stage", record: "KVR-0926-05", from: "Editing", to: "Internal QC", reason: "All 9 edit steps done" },
  { actor: "Janarthanan", at: "24 Sep · 18:12", action: "Approved discount", record: "Lead · Balaji Textiles", from: "Pending (12%)", to: "Approved (10%)", reason: "Countered at authority limit" },
  { actor: "Harini Selvam", at: "24 Sep · 12:30", action: "Approved leave", record: "Naveen Raj", from: "Requested", to: "Approved", reason: "Medical — 25–26 Sep" },
  { actor: "Finance Desk", at: "23 Sep · 16:05", action: "Edited invoice", record: "GM/26-27/044", from: "₹65,000", to: "₹61,750", reason: "5% festive credit agreed" },
  { actor: "Divya Lakshmi", at: "23 Sep · 11:20", action: "Overrode gate", record: "SLS-0926-03", from: "Internal QC", to: "Client Review", reason: "Founder asked to send before Diwali post" },
  { actor: "System", at: "22 Sep · 00:05", action: "Escalated", record: "Asset · Godox SL60W", from: "Checked out", to: "Overdue", reason: "31 hrs > 24 hr threshold" },
];

export function AuditPreview() {
  const [who, setWho] = useState("All");
  const actors = ["All", ...new Set(audit.map((a) => a.actor))];
  const rows = audit.filter((a) => who === "All" || a.actor === who);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {actors.map((a) => (
          <button
            key={a}
            onClick={() => setWho(a)}
            className={cn("cursor-pointer rounded-full border px-2.5 py-0.5 text-body font-medium", who === a ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border">
        <Table>
          <THead>
            <TR>
              <TH>Actor</TH>
              <TH>Time</TH>
              <TH>Action</TH>
              <TH>Record</TH>
              <TH>Old → New</TH>
              <TH>Reason</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((a) => (
              <TR key={a.at + a.record}>
                <TD>
                  <div className="flex items-center gap-2">
                    <Avatar name={a.actor} size="xs" />
                    <span className="whitespace-nowrap">{a.actor}</span>
                  </div>
                </TD>
                <TD className="whitespace-nowrap text-muted-foreground tabular">{a.at}</TD>
                <TD className="whitespace-nowrap">{a.action}</TD>
                <TD className="whitespace-nowrap font-mono text-body">{a.record}</TD>
                <TD className="whitespace-nowrap">
                  <span className="text-muted-foreground line-through decoration-muted-foreground/40">{a.from}</span> <ArrowRight className="inline size-3 text-muted-foreground" />{" "}
                  <span className="font-medium">{a.to}</span>
                </TD>
                <TD className="min-w-[200px] text-muted-foreground">{a.reason}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

// ───────────────────────── Data migration ─────────────────────────

const entities = [
  { name: "Clients", cols: ["client_code", "name", "industry", "city", "approver_name", "approver_phone", "category"], rows: 42 },
  { name: "Employees", cols: ["employee_id", "name", "role", "department", "joined_on", "monthly_ctc", "manager_id"], rows: 19 },
  { name: "Assets", cols: ["asset_tag", "name", "category", "purchase_date", "purchase_value", "custodian", "condition"], rows: 64 },
  { name: "Agreements", cols: ["client_code", "package", "start_date", "end_date", "monthly_fee", "units", "revisions"], rows: 11 },
  { name: "Invoices", cols: ["invoice_no", "client_code", "date", "amount", "gst", "status", "paid_on"], rows: 318 },
];
const steps = ["Download template", "Upload file", "Map columns", "Validate", "Dry run", "Import & reconcile"];

export function MigrationPreview() {
  const [step, setStep] = useState(3);
  const [entity, setEntity] = useState(0);
  const e = entities[entity];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <button
              onClick={() => setStep(i)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-body font-medium transition",
                i < step ? "bg-success-soft text-success" : i === step ? "bg-primary text-white" : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="size-3.5" /> : <span className="tabular">{i + 1}</span>} {s}
            </button>
            {i < steps.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
          </span>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="space-y-1.5">
          {entities.map((x, i) => (
            <button
              key={x.name}
              onClick={() => setEntity(i)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-body transition",
                entity === i ? "border-primary/40 bg-primary-soft/50" : "border-border hover:bg-muted",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                {x.name}
              </span>
              <span className="text-body text-muted-foreground tabular">{x.rows} rows</span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-body font-semibold">{e.name.toLowerCase()}_template.csv</div>
              <div className="text-body text-muted-foreground">{e.cols.length} columns · required columns in bold</div>
            </div>
            <Button size="xs" variant="outline" onClick={() => toast.success(`${e.name} template ready`, { description: e.cols.join(", ") })}>
              <Download /> Template
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {e.cols.map((c, i) => (
              <code key={c} className={cn("rounded-md bg-muted px-2 py-0.5 text-body", i < 3 && "font-bold")}>
                {c}
              </code>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-body">
            <div className="rounded-lg bg-success-soft p-2 text-success">
              <div className="text-subheading font-semibold tabular">{e.rows - 3}</div>valid
            </div>
            <div className="rounded-lg bg-warning-soft p-2 text-warning">
              <div className="text-subheading font-semibold tabular">2</div>warnings
            </div>
            <div className="rounded-lg bg-danger-soft p-2 text-danger">
              <div className="text-subheading font-semibold tabular">1</div>error
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── Documents ─────────────────────────

const docs = [
  { name: "Kaveri Organics — Agreement FY26-27.pdf", icon: FileText, record: "Agreement · Kaveri", by: "Ashwin", v: "v2", size: "1.2 MB", link: false },
  { name: "KVR-0926-05 — final export.mp4", icon: FileVideo, record: "Video · KVR-0926-05", by: "Divya Lakshmi", v: "v3", size: "Drive link", link: true },
  { name: "Sri Lakshmi Silks — brand kit.zip", icon: FileImage, record: "Client · Sri Lakshmi Silks", by: "Meena Ravi", v: "v1", size: "48 MB", link: false },
  { name: "Shoot 19 Sep — kit return photo.jpg", icon: FileImage, record: "SOP run · SOP-PRD-01", by: "Vignesh Kumar", v: "v1", size: "2.4 MB", link: false },
  { name: "Invoice GM/26-27/041.pdf", icon: FileText, record: "Invoice · Urban Nest", by: "Finance Desk", v: "v1", size: "180 KB", link: false },
];

export function FilesPreview() {
  const [sel, setSel] = useState(0);
  const d = docs[sel];
  const Icon = d.icon;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="divide-y divide-border rounded-2xl border border-border">
        {docs.map((x, i) => {
          const I = x.icon;
          return (
            <button key={x.name} onClick={() => setSel(i)} className={cn("flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-body transition", sel === i ? "bg-primary-soft/40" : "hover:bg-muted/50")}>
              <I className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{x.name}</div>
                <div className="text-body text-muted-foreground">{x.record}</div>
              </div>
              {x.link && <Link2 className="size-3.5 text-info" />}
              <Badge tone="outline">{x.v}</Badge>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border border-border p-4">
        <div className="flex aspect-video items-center justify-center rounded-xl bg-muted">
          <Icon className="size-10 text-muted-foreground/60" />
        </div>
        <div className="mt-3 text-body font-medium">{d.name}</div>
        <div className="mt-2 space-y-1 text-body">
          {[
            ["Linked to", d.record],
            ["Uploaded by", d.by],
            ["Version", d.v],
            ["Size", d.size],
            ["Access", "Inherits from linked record"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

