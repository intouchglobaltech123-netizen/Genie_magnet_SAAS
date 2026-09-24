"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, LayoutGrid, List, Network, Plus, Search, UserRoundCheck, Users, UsersRound, Wallet, Plane } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { people as seedPeople, personById, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Department, Person } from "@/lib/types";
import { cn, fmtDate, inrCompact } from "@/lib/utils";
import { departments } from "./data";
import { OrgChart } from "./org-chart";
import { ProfileSheet, StatusBadge } from "./profile-sheet";

type View = "table" | "cards";

export function HrView() {
  const log = useDemo((s) => s.log);
  const [roster, setRoster] = useState<Person[]>(seedPeople);
  const [tab, setTab] = useState<"employee" | "freelancer" | "org">("employee");
  const [dept, setDept] = useState<string>("All");
  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exits, setExits] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);

  const selected = roster.find((p) => p.id === selectedId) ?? null;
  const emps = roster.filter((p) => p.type === "employee");
  const frees = roster.filter((p) => p.type === "freelancer");
  const payroll = emps.reduce((s, p) => s + (p.monthlyCtc ?? 0), 0);
  const onLeave = emps.filter((p) => p.status === "on-leave").length;

  const list = useMemo(() => {
    const type = tab === "freelancer" ? "freelancer" : "employee";
    const needle = q.trim().toLowerCase();
    return roster.filter(
      (p) =>
        p.type === type &&
        (dept === "All" || p.department === dept) &&
        (!needle ||
          p.name.toLowerCase().includes(needle) ||
          p.role.toLowerCase().includes(needle) ||
          p.skills.some((s) => s.toLowerCase().includes(needle))),
    );
  }, [roster, tab, dept, q]);

  const statusOf = (p: Person): Person["status"] => (exits.has(p.id) ? "notice" : p.status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People"
        title="Team & HR"
        description="Everyone who makes Genie Magnet run — roles, reporting lines, skills, documents and the full employee lifecycle."
        depth="preview"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Team directory exported", { description: "genie-magnet-team-sep-2026.xlsx · 19 rows" })}
            >
              Export
            </Button>
            <Button variant="accent" size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add team member
            </Button>
          </>
        }
        className="mb-0"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Employees" value={emps.length} icon={Users} hint="incl. founder" tone="accent" />
        <StatCard label="Freelancers" value={frees.length} icon={UsersRound} hint="on active panel" tone="gold" />
        <StatCard label="On leave today" value={onLeave} icon={Plane} hint={onLeave ? "Naveen Raj · sick leave" : "Full strength"} tone="warning" />
        <StatCard label="Monthly payroll" value={inrCompact(payroll)} icon={Wallet} delta={0.06} deltaLabel="vs Sep 2025" tone="success" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="employee">
              <Users /> Employees <span className="tabular text-muted-foreground">{emps.length}</span>
            </TabsTrigger>
            <TabsTrigger value="freelancer">
              <UsersRound /> Freelancers <span className="tabular text-muted-foreground">{frees.length}</span>
            </TabsTrigger>
            <TabsTrigger value="org">
              <Network /> Org chart
            </TabsTrigger>
          </TabsList>
          {tab !== "org" && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, role, skill" className="h-8 w-60 pl-9 text-[13px]" />
              </div>
              <Select
                value={dept}
                onValueChange={setDept}
                options={departments.map((d) => ({ value: d, label: d === "All" ? "All departments" : d }))}
                className="h-8 w-48 text-[13px]"
              />
              <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
                {(["table", "cards"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-label={v === "table" ? "Table view" : "Card view"}
                    onClick={() => setView(v)}
                    className={cn(
                      "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition",
                      view === v && "bg-muted text-foreground",
                    )}
                  >
                    {v === "table" ? <List className="size-4" /> : <LayoutGrid className="size-4" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {(["employee", "freelancer"] as const).map((t) => (
          <TabsContent key={t} value={t}>
            {list.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-14 text-center">
                <Search className="mb-2 size-6 text-muted-foreground" />
                <div className="text-[14px] font-medium">No one matches these filters</div>
                <Button variant="link" size="sm" onClick={() => { setQ(""); setDept("All"); }}>
                  Clear filters
                </Button>
              </Card>
            ) : view === "table" ? (
              <Card>
                <Table>
                  <THead>
                    <TR>
                      <TH className="pl-5">Name</TH>
                      <TH>Role</TH>
                      <TH>{t === "employee" ? "Manager" : "Department"}</TH>
                      <TH>Skills</TH>
                      <TH>Status</TH>
                      <TH>Joined</TH>
                      <TH className="w-8" />
                    </TR>
                  </THead>
                  <TBody>
                    {list.map((p) => {
                      const mgr = p.managerId ? roster.find((x) => x.id === p.managerId) : null;
                      return (
                        <TR key={p.id} className="cursor-pointer" onClick={() => setSelectedId(p.id)}>
                          <TD className="pl-5">
                            <div className="flex items-center gap-3">
                              <Avatar name={p.name} />
                              <div className="min-w-0">
                                <div className="font-medium">{p.name}</div>
                                <div className="text-[12px] text-muted-foreground">{p.email}</div>
                              </div>
                            </div>
                          </TD>
                          <TD>
                            <div>{p.role}</div>
                            {t === "employee" && <div className="text-[12px] text-muted-foreground">{p.department}</div>}
                          </TD>
                          <TD>
                            {t === "employee" ? (
                              mgr ? (
                                <span className="inline-flex items-center gap-2">
                                  <Avatar name={mgr.name} size="xs" />
                                  {mgr.name.split(" ")[0]}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            ) : (
                              p.department
                            )}
                          </TD>
                          <TD>
                            <div className="flex max-w-64 flex-wrap gap-1">
                              {p.skills.slice(0, 3).map((s) => (
                                <Badge key={s} tone="neutral">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </TD>
                          <TD>
                            <StatusBadge status={statusOf(p)} />
                          </TD>
                          <TD className="whitespace-nowrap tabular text-muted-foreground">
                            {fmtDate(p.joinedOn, { month: "short", year: "numeric" })}
                          </TD>
                          <TD>
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => {
                  const mgr = p.managerId ? personById(p.managerId) : null;
                  return (
                    <Card
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(p.id)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedId(p.id)}
                      className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-accent/40"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar name={p.name} size="lg" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold">{p.name}</div>
                          <div className="truncate text-[12.5px] text-muted-foreground">{p.role}</div>
                        </div>
                        <StatusBadge status={statusOf(p)} />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-1">
                        {p.skills.map((s) => (
                          <Badge key={s} tone="neutral">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground">
                        <span>{mgr ? `Reports to ${mgr.name.split(" ")[0]}` : p.department}</span>
                        <span className="tabular">Since {fmtDate(p.joinedOn, { month: "short", year: "numeric" })}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="org">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Reporting structure</CardTitle>
                <CardDescription>Founder → Company Manager → Leads → Team. Click anyone to open their profile.</CardDescription>
              </div>
              <Badge tone="outline">
                <UserRoundCheck /> {emps.length} employees
              </Badge>
            </CardHeader>
            <CardContent>
              <OrgChart onSelect={(p) => setSelectedId(p.id)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProfileSheet
        person={selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
        exitStarted={!!selected && exits.has(selected.id)}
        onExitStarted={(id) => setExits((s) => new Set(s).add(id))}
      />

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={(p) => {
          setRoster((r) => [...r, p]);
          setTab(p.type);
          log(`${p.name} added as ${p.role} — onboarding checklist started`, "success");
          toast.success(`${p.name} added to the team`, { description: "Offer letter, Aadhaar & PAN collection tasks assigned to Harini." });
        }}
      />
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (p: Person) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState<Department>("Post-Production");
  const [type, setType] = useState<Person["type"]>("employee");

  const submit = () => {
    if (!name.trim() || !role.trim()) {
      toast.error("Name and role are required");
      return;
    }
    const slug = name.trim().split(" ")[0].toLowerCase();
    onAdd({
      id: `${type === "employee" ? "p" : "f"}-${slug}-${Date.now().toString(36)}`,
      name: name.trim(),
      role: role.trim(),
      department,
      type,
      email: type === "employee" ? `${slug}@geniemagnet.in` : `${slug}@gmail.com`,
      phone: "+91 98400 11011",
      joinedOn: TODAY,
      managerId: type === "employee" ? "p-ashwin" : undefined,
      skills: ["New joiner"],
      hourlyCost: 300,
      monthlyCtc: type === "employee" ? 28000 : undefined,
      status: "active",
      utilisation: 0,
    });
    setName("");
    setRole("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>Creates the profile and kicks off the onboarding checklist.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aravind Shankar" autoFocus />
          </Field>
          <Field label="Role / title">
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Junior Video Editor" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <Select
                value={department}
                onValueChange={(v) => setDepartment(v as Department)}
                options={departments.filter((d) => d !== "All").map((d) => ({ value: d, label: d }))}
              />
            </Field>
            <Field label="Type">
              <Select
                value={type}
                onValueChange={(v) => setType(v as Person["type"])}
                options={[
                  { value: "employee", label: "Employee" },
                  { value: "freelancer", label: "Freelancer" },
                ]}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit}>
            Add &amp; start onboarding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
