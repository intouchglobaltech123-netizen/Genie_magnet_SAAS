"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  Gauge,
  Lock,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { people } from "@/lib/mock/core";
import { navSections } from "@/lib/nav";
import { VIDEO_STAGES } from "@/lib/types";
import { cn, inr } from "@/lib/utils";
import {
  ACTIONS,
  defaultMatrix,
  notificationEvents,
  packages,
  RECORDS,
  ROLES,
  stageGates,
  type PermAction,
  type RecordType,
  type SettingsRole,
} from "@/features/platform/settings-data";

const saved = (what?: string) => toast.success("Saved", what ? { description: what } : undefined);

const sections = [
  { id: "org", label: "Organisation", icon: Building2 },
  { id: "users", label: "Users & Roles", icon: Users },
  { id: "packages", label: "Packages", icon: Package },
  { id: "workflow", label: "Statuses & workflow", icon: Workflow },
  { id: "thresholds", label: "Thresholds", icon: Gauge },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;
type SectionId = (typeof sections)[number]["id"];

export function SettingsView() {
  const [section, setSection] = useState<SectionId>("org");
  return (
    <>
      <PageHeader depth="preview" title="Settings" description="Organisation, roles & permissions, packages, workflow gates, thresholds and notifications." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-body font-medium transition",
                  section === s.id ? "bg-card text-foreground shadow-card ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {s.label}
              </button>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-5">
          {section === "org" && <OrgSection />}
          {section === "users" && <UsersSection />}
          {section === "packages" && <PackagesSection />}
          {section === "workflow" && <WorkflowSection />}
          {section === "thresholds" && <ThresholdsSection />}
          {section === "notifications" && <NotificationsSection />}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Organisation ─────────────────────────

function OrgSection() {
  const [depts, setDepts] = useState(["Management", "Sales & Marketing", "Production", "Post-Production", "Social Media", "HR & Admin", "Technology", "Finance"]);
  const [newDept, setNewDept] = useState("");
  const [fy, setFy] = useState("apr");
  const moduleItems = navSections.filter((s) => s.title !== "Overview");
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(moduleItems.flatMap((s) => s.items.map((i) => [i.href, i.depth !== "planned"]))),
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Agency profile</CardTitle>
            <CardDescription>Shown on proposals, invoices and the client portal</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Agency name">
            <Input defaultValue="Genie Magnet" onBlur={() => saved("Agency name")} />
          </Field>
          <Field label="Location">
            <Input defaultValue="Appakudal, Erode District, Tamil Nadu" onBlur={() => saved("Location")} />
          </Field>
          <Field label="Financial year">
            <Select value={fy} onValueChange={(v) => { setFy(v); saved("Financial year"); }} options={[{ value: "apr", label: "April – March" }, { value: "jan", label: "January – December" }]} />
          </Field>
          <Field label="Currency & time zone">
            <Input defaultValue="INR (₹) · Asia/Kolkata" readOnly className="bg-muted text-muted-foreground" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Used for goals, capacity and reporting lines</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {depts.map((d) => (
              <span key={d} className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-body">
                {d}
                <button
                  onClick={() => {
                    setDepts((x) => x.filter((y) => y !== d));
                    toast("Department removed", { description: d });
                  }}
                  className="cursor-pointer text-muted-foreground opacity-0 transition hover:text-danger group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            <form
              className="inline-flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newDept.trim()) return;
                setDepts((x) => [...x, newDept.trim()]);
                saved(`Department “${newDept.trim()}” added`);
                setNewDept("");
              }}
            >
              <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Add department" className="h-8 w-40" />
              <Button type="submit" size="icon-sm" variant="outline">
                <Plus />
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Modules</CardTitle>
            <CardDescription>Turn modules on for your team. Phase 2 modules can be switched on once released.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          {moduleItems.map((s) => (
            <div key={s.title}>
              <div className="mb-1 text-body font-semibold uppercase tracking-wider text-muted-foreground">{s.title}</div>
              <div className="divide-y divide-border">
                {s.items.map((i) => {
                  const Icon = i.icon;
                  const planned = i.depth === "planned";
                  return (
                    <div key={i.href} className="flex items-center gap-3 py-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span className="flex-1 text-body">{i.title}</span>
                      {planned && <Badge>Phase 2</Badge>}
                      <Switch
                        checked={enabled[i.href]}
                        disabled={planned}
                        onCheckedChange={(c) => {
                          setEnabled((x) => ({ ...x, [i.href]: c }));
                          saved(`${i.title} ${c ? "enabled" : "disabled"}`);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

// ───────────────────────── Users & roles ─────────────────────────

const roleFor = (id: string, title: string): SettingsRole => {
  if (id === "p-jana") return "Founder";
  if (id === "p-ashwin") return "Manager";
  if (id.startsWith("f-")) return "Freelancer";
  if (/Sales/.test(title)) return "Sales";
  if (/Editor/.test(title)) return "Editor";
  if (/HR/.test(title)) return "HR";
  return "Production";
};

function UsersSection() {
  const [roles, setRoles] = useState<Record<string, SettingsRole>>(() => Object.fromEntries(people.map((p) => [p.id, roleFor(p.id, p.role)])));
  const [matrix, setMatrix] = useState(defaultMatrix);
  const [role, setRole] = useState<SettingsRole>("Manager");

  const toggle = (rec: RecordType, a: PermAction) => {
    if (role === "Founder" && rec === "Settings") {
      toast.error("The founder always keeps full access to Settings");
      return;
    }
    const has = matrix[role][rec].includes(a);
    setMatrix((m) => ({ ...m, [role]: { ...m[role], [rec]: has ? m[role][rec].filter((x) => x !== a) : [...m[role][rec], a] } }));
    saved(`${role}: ${a} on ${rec} ${has ? "removed" : "granted"}`);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              {people.filter((p) => p.type === "employee").length} employees · {people.filter((p) => p.type === "freelancer").length} freelancers
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => toast.success("Invite sent", { description: "Invitation link emailed (demo)" })}>
            <Plus /> Invite user
          </Button>
        </CardHeader>
        <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Title</TH>
                <TH>Department</TH>
                <TH>Status</TH>
                <TH className="w-44">Role</TH>
              </TR>
            </THead>
            <TBody>
              {people.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} size="sm" />
                      <div className="leading-tight">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-body text-muted-foreground">{p.email}</div>
                      </div>
                    </div>
                  </TD>
                  <TD className="text-muted-foreground">{p.role}</TD>
                  <TD className="text-muted-foreground">{p.department}</TD>
                  <TD>
                    <Badge tone={p.status === "active" ? "success" : "warning"} dot>
                      {p.status === "active" ? "Active" : "On leave"}
                    </Badge>
                  </TD>
                  <TD>
                    <Select
                      value={roles[p.id]}
                      onValueChange={(v) => {
                        setRoles((r) => ({ ...r, [p.id]: v as SettingsRole }));
                        saved(`${p.name} is now ${v}`);
                      }}
                      options={ROLES.filter((r) => r !== "Client").map((r) => ({ value: r, label: r }))}
                      className="h-8"
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" /> Permission matrix
            </CardTitle>
            <CardDescription>Click a cell to grant or revoke. Record-level scope (own / team / all) is set per role in Phase 2.</CardDescription>
          </div>
        </CardHeader>
        <div className="flex flex-wrap gap-1.5 px-5 pb-4">
          {ROLES.map((r) => {
            const count = RECORDS.reduce((s, rec) => s + matrix[r][rec].length, 0);
            return (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-1.5 text-body font-medium transition",
                  role === r ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {r} <span className="ml-1 text-body opacity-70 tabular">{count}</span>
              </button>
            );
          })}
        </div>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Record type</TH>
              {ACTIONS.map((a) => (
                <TH key={a} className="text-center capitalize">
                  {a}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {RECORDS.map((rec) => {
              const privateRec = rec === "Personal finance planner";
              return (
                <TR key={rec}>
                  <TD className="pl-5">
                    <div className="flex items-center gap-2 font-medium">
                      {rec}
                      {privateRec && (
                        <Tooltip content="Own records only — no role can see another person's personal finances">
                          <span>
                            <Badge tone="gold">
                              <Lock /> Own only
                            </Badge>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </TD>
                  {ACTIONS.map((a) => {
                    const on = matrix[role][rec].includes(a);
                    return (
                      <TD key={a} className="text-center">
                        <button
                          onClick={() => toggle(rec, a)}
                          className={cn(
                            "inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition",
                            on ? "bg-success-soft text-success hover:brightness-95" : "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground",
                          )}
                        >
                          {on ? <Check className="size-4" strokeWidth={2.6} /> : <Minus className="size-3.5" />}
                        </button>
                      </TD>
                    );
                  })}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

// ───────────────────────── Packages ─────────────────────────

function PackagesSection() {
  const [list, setList] = useState(packages.map((p) => ({ ...p, active: true })));
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Package templates</CardTitle>
          <CardDescription>Agreements start from a template — units, revision allowance and turnaround flow into cycles and reconciliation.</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setList((l) => [...l, { name: "New package", service: "Video Production", fee: 0, units: "Define units", revisions: 2, turnaround: 5, clients: 0, active: false }]);
            saved("Draft package added");
          }}
        >
          <Plus /> New template
        </Button>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Package</TH>
            <TH>Units per cycle</TH>
            <TH className="text-center">Revisions</TH>
            <TH className="text-center">Turnaround</TH>
            <TH className="text-right">Monthly fee</TH>
            <TH className="text-center">Clients</TH>
            <TH className="text-center">Active</TH>
          </TR>
        </THead>
        <TBody>
          {list.map((p, i) => (
            <TR key={p.name + i}>
              <TD className="pl-5">
                <div className="font-medium">{p.name}</div>
                <div className="text-body text-muted-foreground">{p.service}</div>
              </TD>
              <TD className="text-muted-foreground">{p.units}</TD>
              <TD className="text-center tabular">{p.revisions}</TD>
              <TD className="text-center tabular">{p.turnaround} days</TD>
              <TD className="text-right font-medium tabular">{p.fee ? inr(p.fee) : "—"}</TD>
              <TD className="text-center tabular">{p.clients}</TD>
              <TD className="text-center">
                <Switch
                  checked={p.active}
                  onCheckedChange={(c) => {
                    setList((l) => l.map((x, j) => (j === i ? { ...x, active: c } : x)));
                    saved(`${p.name} ${c ? "available for new agreements" : "hidden from new agreements"}`);
                  }}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

// ───────────────────────── Workflow ─────────────────────────

function WorkflowSection() {
  const [gates, setGates] = useState(stageGates);
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Video stages</CardTitle>
            <CardDescription>The lifecycle every video code moves through</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            {VIDEO_STAGES.map((s, i) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="rounded-lg border border-border bg-card px-2.5 py-1 text-body font-medium">
                  <span className="mr-1.5 text-muted-foreground tabular">{i + 1}</span>
                  {s}
                </span>
                {i < VIDEO_STAGES.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>Stage gates</CardTitle>
            <CardDescription>An enforced gate blocks the move until its condition is met. Overrides need a reason and are logged.</CardDescription>
          </div>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Transition</TH>
              <TH>Gate condition</TH>
              <TH className="text-center">Enforced</TH>
            </TR>
          </THead>
          <TBody>
            {gates.map((g, i) => (
              <TR key={g.from + g.to}>
                <TD className="pl-5 whitespace-nowrap">
                  <span className="text-muted-foreground">{g.from}</span> <ChevronRight className="inline size-3.5 text-muted-foreground" />{" "}
                  <span className="font-medium">{g.to}</span>
                </TD>
                <TD>{g.gate}</TD>
                <TD className="text-center">
                  <Switch
                    checked={g.enforced}
                    onCheckedChange={(c) => {
                      setGates((x) => x.map((y, j) => (j === i ? { ...y, enforced: c } : y)));
                      saved(`Gate ${g.from} → ${g.to} ${c ? "enforced" : "advisory only"}`);
                    }}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

// ───────────────────────── Thresholds ─────────────────────────

function ThresholdsSection() {
  const items = [
    { key: "util", label: "Utilisation overload", desc: "Flag a person as overloaded above this weekly utilisation", value: 100, unit: "%", min: 70, max: 130, step: 5 },
    { key: "disc", label: "Max sales discount", desc: "Sales can approve up to this; above needs founder approval", value: 10, unit: "%", min: 0, max: 25, step: 1 },
    { key: "asset", label: "Overdue asset", desc: "Kit not returned after this many hours escalates to the manager", value: 24, unit: "hrs", min: 6, max: 72, step: 6 },
    { key: "resp", label: "Client response window", desc: "Days a client has to review before the delay is on the client", value: 3, unit: "days", min: 1, max: 7, step: 1 },
    { key: "inv", label: "Invoice overdue", desc: "Days after due date before escalation to the founder", value: 30, unit: "days", min: 7, max: 60, step: 1 },
    { key: "rev", label: "Revision alert", desc: "Warn when revisions used reach this share of the allowance", value: 80, unit: "%", min: 50, max: 100, step: 10 },
  ];
  const [vals, setVals] = useState<Record<string, number>>(() => Object.fromEntries(items.map((i) => [i.key, i.value])));
  const [quiet, setQuiet] = useState(true);
  const [qStart, setQStart] = useState("21");
  const [qEnd, setQEnd] = useState("08");

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Thresholds</CardTitle>
            <CardDescription>These drive alerts, approvals and escalations across the system</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {items.map((i) => (
            <div key={i.key} className="grid items-center gap-3 py-4 first:pt-0 md:grid-cols-[1fr_260px_80px]">
              <div>
                <div className="text-body font-medium">{i.label}</div>
                <div className="text-body text-muted-foreground">{i.desc}</div>
              </div>
              <input
                type="range"
                min={i.min}
                max={i.max}
                step={i.step}
                value={vals[i.key]}
                onChange={(e) => setVals((v) => ({ ...v, [i.key]: Number(e.target.value) }))}
                onPointerUp={() => saved(`${i.label}: ${vals[i.key]} ${i.unit}`)}
                onKeyUp={() => saved(`${i.label}: ${vals[i.key]} ${i.unit}`)}
                className="w-full cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="text-right text-subheading font-semibold tabular">
                {vals[i.key]} <span className="text-body font-normal text-muted-foreground">{i.unit}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Quiet hours</CardTitle>
            <CardDescription>No WhatsApp or email alerts to staff during these hours — except rush items</CardDescription>
          </div>
          <Switch
            checked={quiet}
            onCheckedChange={(c) => {
              setQuiet(c);
              saved(`Quiet hours ${c ? "on" : "off"}`);
            }}
          />
        </CardHeader>
        <CardContent className={cn("flex flex-wrap items-center gap-3", !quiet && "opacity-50")}>
          <Select value={qStart} onValueChange={(v) => { setQStart(v); saved(`Quiet hours from ${v}:00`); }} options={["20", "21", "22"].map((h) => ({ value: h, label: `${h}:00` }))} className="w-28" />
          <span className="text-body text-muted-foreground">to</span>
          <Select value={qEnd} onValueChange={(v) => { setQEnd(v); saved(`Quiet hours until ${v}:00`); }} options={["07", "08", "09"].map((h) => ({ value: h, label: `${h}:00` }))} className="w-28" />
          <span className="text-body text-muted-foreground">IST · Sundays all day</span>
        </CardContent>
      </Card>
    </>
  );
}

// ───────────────────────── Notifications ─────────────────────────

function NotificationsSection() {
  const [rows, setRows] = useState(notificationEvents);
  const channels = [
    { key: "inApp", label: "In-app" },
    { key: "email", label: "Email" },
    { key: "whatsapp", label: "WhatsApp" },
  ] as const;
  const groups = [...new Set(rows.map((r) => r.group))];
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Which events reach people, and where. WhatsApp uses the business number once the integration is live.</CardDescription>
        </div>
      </CardHeader>
      <Table>
        <THead>
          <TR>
            <TH className="pl-5">Event</TH>
            {channels.map((c) => (
              <TH key={c.key} className="text-center">
                {c.label}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {groups.map((g) => (
            <GroupRows
              key={g}
              group={g}
              rows={rows.filter((r) => r.group === g)}
              channels={channels}
              onToggle={(event, key, c) => {
                setRows((all) => all.map((r) => (r.event === event ? { ...r, [key]: c } : r)));
                saved(`${event}: ${channels.find((x) => x.key === key)!.label} ${c ? "on" : "off"}`);
              }}
            />
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

function GroupRows({
  group,
  rows,
  channels,
  onToggle,
}: {
  group: string;
  rows: typeof notificationEvents;
  channels: readonly { key: "inApp" | "email" | "whatsapp"; label: string }[];
  onToggle: (event: string, key: "inApp" | "email" | "whatsapp", c: boolean) => void;
}) {
  return (
    <>
      <TR className="bg-muted/40 hover:bg-muted/40">
        <TD colSpan={4} className="py-1.5 pl-5 text-body font-semibold uppercase tracking-wider text-muted-foreground">
          {group}
        </TD>
      </TR>
      {rows.map((r) => (
        <TR key={r.event}>
          <TD className="pl-5">{r.event}</TD>
          {channels.map((c) => (
            <TD key={c.key} className="text-center">
              <Switch checked={r[c.key]} onCheckedChange={(v) => onToggle(r.event, c.key, v)} />
            </TD>
          ))}
        </TR>
      ))}
    </>
  );
}
