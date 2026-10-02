"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, FileSpreadsheet, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  ATTENDANCE_STATUS_LABEL,
  type AttendanceSettings,
  type AttendanceStatus,
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_TYPES,
  type EmployeeRow,
  type LeaveRequestRow,
  type LeaveTypeRow,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { FilesCard } from "./files";
import { MonthSwitcher, thisMonth } from "./production-bits";
import {
  useAttendance,
  useAttendanceAction,
  useAttendanceSettings,
  useCan,
  useCorrections,
  useDepartments,
  useLeaveAction,
  useLeaveBalances,
  useLeaveRequests,
  useLeaveTypes,
  useMayDecide,
  useMe,
  usePeople,
  usePeopleAction,
} from "./queries";

const fmt = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const issuesOf = (setErrors: (e: Record<string, string>) => void) => (e: unknown) =>
  e instanceof ApiError && e.body.issues ? setErrors(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message]))) : toast.error(errorMessage(e));

// ─── People (P5-06) ───────────────────────────────────────────────────

function EmployeeDialog({ p, onClose }: { p: EmployeeRow; onClose: () => void }) {
  const can = useCan();
  const deps = useDepartments();
  const act = usePeopleAction();
  const editable = can("hr", "edit");
  const [f, setF] = useState({
    employeeCode: p.employeeCode ?? "",
    departmentId: p.department?.id ?? "",
    designation: p.designation ?? "",
    employmentType: p.employmentType,
    joiningDate: p.joiningDate ?? "",
    exitDate: p.exitDate ?? "",
    phone: p.phone ?? "",
    personalEmail: p.personalEmail ?? "",
    dateOfBirth: p.dateOfBirth ?? "",
    address: p.address ?? "",
    emergencyName: p.emergencyName ?? "",
    emergencyPhone: p.emergencyPhone ?? "",
  });
  const [bank, setBank] = useState({ bankAccount: "", ifsc: p.bank?.ifsc ?? "", pan: "", uan: p.bank?.uan ?? "", esiNumber: p.bank?.esiNumber ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{p.user.name}</DialogTitle>
          <DialogDescription>
            {p.user.email}
            {p.role && ` · ${p.role.replace(/_/g, " ")}`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <fieldset disabled={!editable} className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee code" hint="As the attendance device knows them" error={errors.employeeCode}>
              <Input value={f.employeeCode} onChange={set("employeeCode")} />
            </Field>
            <Field label="Department">
              <Select
                value={f.departmentId || "_none"}
                onValueChange={(v) => setF({ ...f, departmentId: v === "_none" ? "" : v })}
                options={[{ value: "_none", label: "None" }, ...(deps.data ?? []).map((d) => ({ value: d.id, label: d.name }))]}
              />
            </Field>
            <Field label="Designation">
              <Input value={f.designation} onChange={set("designation")} />
            </Field>
            <Field label="Employment">
              <Select
                value={f.employmentType}
                onValueChange={(v) => setF({ ...f, employmentType: v as typeof f.employmentType })}
                options={EMPLOYMENT_TYPES.map((x) => ({ value: x, label: EMPLOYMENT_TYPE_LABEL[x] }))}
              />
            </Field>
            <Field label="Joined" error={errors.joiningDate}>
              <Input type="date" value={f.joiningDate} onChange={set("joiningDate")} />
            </Field>
            <Field label="Left" error={errors.exitDate}>
              <Input type="date" value={f.exitDate} onChange={set("exitDate")} />
            </Field>
            <Field label="Phone">
              <Input value={f.phone} onChange={set("phone")} />
            </Field>
            <Field label="Personal email" error={errors.personalEmail}>
              <Input value={f.personalEmail} onChange={set("personalEmail")} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} />
            </Field>
            <Field label="Emergency contact">
              <div className="flex gap-2">
                <Input placeholder="Name" value={f.emergencyName} onChange={set("emergencyName")} />
                <Input placeholder="Phone" value={f.emergencyPhone} onChange={set("emergencyPhone")} />
              </div>
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea rows={2} value={f.address} onChange={set("address")} />
            </Field>
          </fieldset>
          {p.bank && (
            <SectionCard title="Payroll details" description="Kept encrypted; only the last characters are ever shown.">
              <p className="mb-3 text-body text-muted-foreground">
                Account {p.bank.account ?? "not set"} · IFSC {p.bank.ifsc ?? "—"} · PAN {p.bank.pan ?? "not set"} · UAN {p.bank.uan ?? "—"} · ESI{" "}
                {p.bank.esiNumber ?? "—"}
              </p>
              {can("salaries", "edit") && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="New account number" error={errors.bankAccount}>
                    <Input value={bank.bankAccount} onChange={(e) => setBank({ ...bank, bankAccount: e.target.value })} autoComplete="off" />
                  </Field>
                  <Field label="IFSC" error={errors.ifsc}>
                    <Input value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value })} />
                  </Field>
                  <Field label="New PAN" error={errors.pan}>
                    <Input value={bank.pan} onChange={(e) => setBank({ ...bank, pan: e.target.value })} autoComplete="off" />
                  </Field>
                  <Field label="UAN">
                    <Input value={bank.uan} onChange={(e) => setBank({ ...bank, uan: e.target.value })} />
                  </Field>
                  <Field label="ESI number">
                    <Input value={bank.esiNumber} onChange={(e) => setBank({ ...bank, esiNumber: e.target.value })} />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(
                          {
                            step: "bank",
                            userId: p.user.id,
                            body: {
                              ...(bank.bankAccount && { bankAccount: bank.bankAccount }),
                              ...(bank.pan && { pan: bank.pan }),
                              ifsc: bank.ifsc,
                              uan: bank.uan,
                              esiNumber: bank.esiNumber,
                            },
                          },
                          { onSuccess: () => (toast.success("Payroll details saved"), onClose()), onError: issuesOf(setErrors) },
                        )
                      }
                    >
                      Save payroll details
                    </Button>
                  </div>
                </div>
              )}
            </SectionCard>
          )}
          {can("hr", "view") && (
            <FilesCard entity="employee" entityId={p.user.id} title="Documents" description="Offer letter, ID and address proof. HR only." canEdit={editable} />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {editable && (
            <Button
              disabled={act.isPending}
              onClick={() =>
                act.mutate(
                  { step: "update", userId: p.user.id, body: f },
                  { onSuccess: () => (toast.success("Saved"), onClose()), onError: issuesOf(setErrors) },
                )
              }
            >
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Departments() {
  const deps = useDepartments();
  const act = usePeopleAction();
  const [name, setName] = useState("");
  return (
    <SectionCard title="Departments">
      <ul className="mb-3 divide-y divide-border-subtle">
        {deps.data?.map((d) => (
          <li key={d.id} className="flex items-center justify-between py-1.5 text-body">
            <span>
              {d.name} <span className="text-muted-foreground">· {d.people}</span>
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${d.name}`}
              onClick={() => act.mutate({ step: "removeDepartment", id: d.id }, { onError: (e) => toast.error(errorMessage(e)) })}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="e.g. Post-production" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          variant="secondary"
          disabled={name.trim().length < 2 || act.isPending}
          onClick={() =>
            act.mutate({ step: "addDepartment", name: name.trim() }, { onSuccess: () => setName(""), onError: (e) => toast.error(errorMessage(e)) })
          }
        >
          <Plus />
          Add
        </Button>
      </div>
    </SectionCard>
  );
}

/** /app/people: employee records (HR), or your own. */
export function LivePeople() {
  const can = useCan();
  const people = usePeople();
  const [open, setOpen] = useState<EmployeeRow | null>(null);
  return (
    <>
      <PageHeader
        title="People"
        description={
          can("hr", "view")
            ? "Everyone's employee record: code, department, dates, contacts and documents. Payroll details are for payroll only."
            : "Your employee record."
        }
      />
      <div className={cn("grid gap-4", can("hr", "edit") && "lg:grid-cols-[1fr_300px]")}>
        {people.isPending ? (
          <SkeletonRows rows={6} />
        ) : people.error ? (
          <Alert tone="danger">{errorMessage(people.error)}</Alert>
        ) : (
          <Card className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Person</TH>
                  <TH>Code</TH>
                  <TH>Department</TH>
                  <TH>Joined</TH>
                </TR>
              </THead>
              <TBody>
                {people.data.map((p) => (
                  <TR key={p.user.id} className="cursor-pointer" onClick={() => setOpen(p)}>
                    <TD>
                      <div className="font-medium">{p.user.name}</div>
                      <div className="text-muted-foreground">{p.designation ?? p.role?.replace(/_/g, " ")}</div>
                    </TD>
                    <TD className="font-mono">{p.employeeCode ?? "—"}</TD>
                    <TD>{p.department?.name ?? "—"}</TD>
                    <TD>{fmt(p.joiningDate)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
        {can("hr", "edit") && <Departments />}
      </div>
      {open && <EmployeeDialog p={open} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Attendance (P5-07) ───────────────────────────────────────────────

const CELL: Record<AttendanceStatus, { short: string; cls: string }> = {
  present: { short: "P", cls: "bg-success-soft text-success" },
  late: { short: "L", cls: "bg-warning-soft text-warning" },
  half_day: { short: "½", cls: "bg-warning-soft text-warning" },
  absent: { short: "A", cls: "bg-danger-soft text-danger" },
  leave: { short: "LV", cls: "bg-info-soft text-info" },
  holiday: { short: "H", cls: "bg-muted text-muted-foreground" },
  weekly_off: { short: "—", cls: "text-muted-foreground" },
};

function MonthGrid({ month }: { month: string }) {
  const a = useAttendance(month);
  if (a.isPending) return <SkeletonRows rows={6} />;
  if (a.error) return <Alert tone="danger">{errorMessage(a.error)}</Alert>;
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const dates = Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const off = new Map(a.data.offDays.map((d) => [d.date, d.name]));
  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card px-3 py-2 text-left font-medium">Person</th>
            {dates.map((d) => (
              <th
                key={d}
                className={cn("w-7 px-0.5 py-2 text-center font-normal text-muted-foreground", off.has(d) && "bg-muted")}
                title={off.get(d) ?? undefined}
              >
                {Number(d.slice(8))}
              </th>
            ))}
            <th className="px-2 text-right font-medium">P</th>
            <th className="px-2 text-right font-medium">L</th>
            <th className="px-2 text-right font-medium">½</th>
            <th className="px-2 text-right font-medium">A</th>
            <th className="px-2 text-right font-medium">LV</th>
          </tr>
        </thead>
        <tbody>
          {a.data.people.map((p) => (
            <tr key={p.user.id} className="border-t border-border-subtle">
              <td className="sticky left-0 whitespace-nowrap bg-card px-3 py-1.5 font-medium">{p.user.name}</td>
              {dates.map((d) => {
                const day = p.days[d];
                const c = day ? CELL[day.status] : null;
                return (
                  <td key={d} className={cn("px-0.5 py-1 text-center", off.has(d) && !day && "bg-muted")}>
                    {c && (
                      <span
                        className={cn("inline-block min-w-6 rounded px-0.5", c.cls)}
                        title={`${ATTENDANCE_STATUS_LABEL[day!.status]}${day!.firstIn ? ` · ${day!.firstIn}${day!.lastOut ? `–${day!.lastOut}` : ""}` : ""}${day!.source === "correction" ? " · corrected" : ""}`}
                      >
                        {c.short}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 text-right tabular-nums">{p.totals.present}</td>
              <td className="px-2 text-right tabular-nums">{p.totals.late}</td>
              <td className="px-2 text-right tabular-nums">{p.totals.half_day}</td>
              <td className="px-2 text-right tabular-nums">{p.totals.absent}</td>
              <td className="px-2 text-right tabular-nums">{p.totals.leave}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border-subtle px-4 py-2 text-body text-muted-foreground">
        P present · L late · ½ half day · A absent · LV on leave · H holiday · — weekly off. Absent days are counted up to each person&rsquo;s last day in the export,
        so people who don&rsquo;t use the device are never marked absent.
      </p>
    </Card>
  );
}

function CorrectionDialog({ onClose }: { onClose: () => void }) {
  const act = useAttendanceAction();
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), firstIn: "", lastOut: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask for a correction</DialogTitle>
          <DialogDescription>A missed punch or a day on a shoot elsewhere. HR approves it.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-3">
          <Field label="Day" error={errors.date}>
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="In" error={errors.firstIn}>
            <Input type="time" value={f.firstIn} onChange={(e) => setF({ ...f, firstIn: e.target.value })} />
          </Field>
          <Field label="Out" error={errors.lastOut}>
            <Input type="time" value={f.lastOut} onChange={(e) => setF({ ...f, lastOut: e.target.value })} />
          </Field>
          <Field label="What happened" error={errors.reason} className="sm:col-span-3">
            <Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate(
                { step: "correct", body: { date: f.date, firstIn: f.firstIn || undefined, lastOut: f.lastOut || undefined, reason: f.reason } },
                { onSuccess: () => (toast.success("Sent to HR"), onClose()), onError: issuesOf(setErrors) },
              )
            }
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Corrections() {
  const mayDecide = useMayDecide();
  const list = useCorrections();
  const act = useAttendanceAction();
  if (list.isPending) return <SkeletonRows rows={3} />;
  if (!list.data?.length) return <EmptyState title="No corrections" description="Ask for one when a day is not right." />;
  return (
    <ul className="space-y-2">
      {list.data.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-body">
          <span>
            <span className="font-medium">{c.user.name}</span> · {fmt(c.date)} · {c.firstIn ?? "—"} to {c.lastOut ?? "—"}
            <span className="block text-muted-foreground">{c.reason}</span>
          </span>
          {c.state === "pending" && mayDecide("hr", c.user.id) ? (
            <span className="flex gap-1.5">
              <Button
                size="xs"
                variant="ghost"
                onClick={() =>
                  act.mutate({ step: "decide", id: c.id, approved: false, note: "Not as recorded" }, { onError: (e) => toast.error(errorMessage(e)) })
                }
              >
                <X />
                No
              </Button>
              <Button
                size="xs"
                variant="success"
                onClick={() => act.mutate({ step: "decide", id: c.id, approved: true }, { onError: (e) => toast.error(errorMessage(e)) })}
              >
                <Check />
                Correct it
              </Button>
            </span>
          ) : (
            <Badge tone={c.state === "approved" ? "success" : c.state === "rejected" ? "danger" : "warning"}>
              {c.state === "approved" ? "Corrected" : c.state === "rejected" ? "Not changed" : "Waiting"}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Rules({ s }: { s: AttendanceSettings }) {
  const act = useAttendanceAction();
  const [f, setF] = useState(s);
  const [holiday, setHoliday] = useState({ date: "", name: "" });
  return (
    <SectionCard title="Your rules" description="How a day is read from the first in and last out.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Day starts at">
          <Input type="time" value={f.workdayStart} onChange={(e) => setF({ ...f, workdayStart: e.target.value })} />
        </Field>
        <Field label="Late after (minutes)">
          <Input type="number" min={0} value={f.lateAfter} onChange={(e) => setF({ ...f, lateAfter: Number(e.target.value) })} />
        </Field>
        <Field label="Half day under (minutes)">
          <Input type="number" min={0} value={f.halfDayBelow} onChange={(e) => setF({ ...f, halfDayBelow: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-body">
        <span className="text-muted-foreground">Weekly off:</span>
        {WEEKDAYS.map((d, i) => (
          <label key={d} className="flex items-center gap-1.5">
            <Checkbox
              checked={f.weeklyOffs.includes(i)}
              onCheckedChange={(c) => setF({ ...f, weeklyOffs: c === true ? [...f.weeklyOffs, i].sort() : f.weeklyOffs.filter((x) => x !== i) })}
            />
            {d}
          </label>
        ))}
      </div>
      <div className="mt-3">
        <div className="mb-1 text-body text-muted-foreground">Holidays</div>
        <ul className="mb-2 flex flex-wrap gap-2">
          {f.holidays.map((h) => (
            <li key={h.date}>
              <Badge tone="neutral">
                {fmt(h.date)} · {h.name}
                <button
                  type="button"
                  className="ml-1"
                  aria-label={`Remove ${h.name}`}
                  onClick={() => setF({ ...f, holidays: f.holidays.filter((x) => x.date !== h.date) })}
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input type="date" className="w-44" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} />
          <Input placeholder="e.g. Pongal" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
          <Button
            variant="secondary"
            disabled={!holiday.date || !holiday.name.trim()}
            onClick={() => (
              setF({
                ...f,
                holidays: [...f.holidays.filter((x) => x.date !== holiday.date), { date: holiday.date, name: holiday.name.trim() }].sort((a, b) =>
                  a.date.localeCompare(b.date),
                ),
              }),
              setHoliday({ date: "", name: "" })
            )}
          >
            Add
          </Button>
        </div>
      </div>
      <Button
        className="mt-4"
        disabled={act.isPending}
        onClick={() => act.mutate({ step: "settings", body: f }, { onSuccess: () => toast.success("Saved"), onError: (e) => toast.error(errorMessage(e)) })}
      >
        Save the rules
      </Button>
    </SectionCard>
  );
}

/** /app/attendance: the month, corrections, and the agency's rules. */
export function LiveAttendance() {
  const can = useCan();
  const settings = useAttendanceSettings();
  const [month, setMonth] = useState(thisMonth());
  const [tab, setTab] = useState<"month" | "corrections" | "rules">("month");
  const [asking, setAsking] = useState(false);
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Each day from your attendance device's export, corrected when HR approves, with leave and holidays."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAsking(true)}>
              Ask for a correction
            </Button>
            {can("hr", "edit") && (
              <Button asChild>
                <Link href="/app/import?kind=attendance">
                  <FileSpreadsheet />
                  Import the export
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="corrections">Corrections</TabsTrigger>
            {can("hr", "edit") && <TabsTrigger value="rules">Rules</TabsTrigger>}
          </TabsList>
        </Tabs>
        {tab === "month" && <MonthSwitcher month={month} onChange={setMonth} />}
      </div>
      {tab === "month" ? (
        <MonthGrid month={month} />
      ) : tab === "corrections" ? (
        <Corrections />
      ) : settings.data ? (
        <Rules s={settings.data} />
      ) : (
        <SkeletonRows rows={4} />
      )}
      {asking && <CorrectionDialog onClose={() => setAsking(false)} />}
    </>
  );
}

// ─── Leave (P5-08) ────────────────────────────────────────────────────

const LEAVE_STATUS: Record<LeaveRequestRow["status"], { label: string; tone: "warning" | "success" | "danger" | "neutral" }> = {
  pending: { label: "Waiting", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  cancelled: { label: "Withdrawn", tone: "neutral" },
};

function LeaveDialog({ onClose }: { onClose: () => void }) {
  const types = useLeaveTypes();
  const act = useLeaveAction();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ typeId: "", from: today, to: today, halfDay: false, reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ask for leave</DialogTitle>
          <DialogDescription>Weekly offs and holidays in between are not counted. HR approves it.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Kind of leave" error={errors.typeId} className="sm:col-span-2">
            <Select
              value={f.typeId || undefined}
              placeholder="Choose"
              onValueChange={(v) => setF({ ...f, typeId: v })}
              options={(types.data ?? [])
                .filter((t) => t.active)
                .map((t) => ({ value: t.id, label: t.paid || /unpaid/i.test(t.name) ? t.name : `${t.name} (unpaid)` }))}
            />
          </Field>
          <Field label="From" error={errors.from}>
            <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} />
          </Field>
          <Field label="To" error={errors.to}>
            <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-body sm:col-span-2">
            <Switch aria-label="Half a day" checked={f.halfDay} disabled={f.from !== f.to} onCheckedChange={(halfDay) => setF({ ...f, halfDay })} />
            Half a day
          </label>
          <Field label="Why" error={errors.reason} className="sm:col-span-2">
            <Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending}
            onClick={() =>
              act.mutate({ step: "request", body: f }, { onSuccess: () => (toast.success("Sent to HR"), onClose()), onError: issuesOf(setErrors) })
            }
          >
            Ask
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Requests({ status, decide }: { status: string; decide: boolean }) {
  const me = useMe().data!;
  const list = useLeaveRequests(status);
  const act = useLeaveAction();
  const mayDecide = useMayDecide();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (list.isPending) return <SkeletonRows rows={3} />;
  if (!list.data?.length) return <EmptyState title="Nothing here" />;
  return (
    <ul className="space-y-2">
      {list.data.map((r) => (
        <li key={r.id} className="rounded-xl border border-border bg-card p-3 text-body">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span>
              <span className="font-medium">{r.user.name}</span> · {r.type.name} · {fmt(r.from)}
              {r.to !== r.from && ` to ${fmt(r.to)}`} · {r.days} {r.days === 1 ? "day" : "days"}
              <span className="block text-muted-foreground">{r.reason}</span>
              {r.note && <span className="block text-muted-foreground">HR: {r.note}</span>}
            </span>
            <Badge tone={LEAVE_STATUS[r.status].tone}>{LEAVE_STATUS[r.status].label}</Badge>
          </div>
          {r.clashes.length > 0 && r.status === "pending" && (
            <Alert tone="warning" className="mt-2">
              Clashes with:{" "}
              {r.clashes.map((c, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <Link href={c.link} className="underline">
                    {c.label}
                  </Link>{" "}
                  ({fmt(c.date)})
                </span>
              ))}
            </Alert>
          )}
          {r.status === "pending" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {decide && mayDecide("hr", r.user.id) && (
                <>
                  <Input
                    className="max-w-xs"
                    placeholder="Note (needed to say no)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  />
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={!notes[r.id]?.trim()}
                    onClick={() =>
                      act.mutate({ step: "decide", id: r.id, approved: false, note: notes[r.id] }, { onError: (e) => toast.error(errorMessage(e)) })
                    }
                  >
                    <X />
                    Not approved
                  </Button>
                  <Button
                    size="xs"
                    variant="success"
                    onClick={() =>
                      act.mutate({ step: "decide", id: r.id, approved: true, note: notes[r.id] || undefined }, { onError: (e) => toast.error(errorMessage(e)) })
                    }
                  >
                    <Check />
                    Approve
                  </Button>
                </>
              )}
              {r.user.id === me.user.id && (
                <Button size="xs" variant="ghost" onClick={() => act.mutate({ step: "cancel", id: r.id }, { onError: (e) => toast.error(errorMessage(e)) })}>
                  Withdraw
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Balances() {
  const year = new Date().getUTCFullYear();
  const b = useLeaveBalances(year);
  if (b.isPending) return <SkeletonRows rows={4} />;
  const types = b.data?.[0]?.types ?? [];
  return (
    <Card className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>{year}</TH>
            {types.map((t) => (
              <TH key={t.id} numeric>
                {t.name}
              </TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {(b.data ?? []).map((p) => (
            <TR key={p.user.id}>
              <TD className="font-medium">{p.user.name}</TD>
              {p.types.map((t) => (
                <TD key={t.id} numeric>
                  {t.left === null ? `${t.taken} taken` : `${t.left} left`}
                  {t.carried > 0 && <div className="text-muted-foreground">incl. {t.carried} carried</div>}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}

function LeaveKinds() {
  const types = useLeaveTypes();
  const act = useLeaveAction();
  const [draft, setDraft] = useState<(Omit<LeaveTypeRow, "id"> & { id?: string })[] | null>(null);
  const rows = draft ?? types.data ?? [];
  const set = (i: number, patch: Partial<LeaveTypeRow>) => setDraft(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <SectionCard title="Kinds of leave" description="Days a year (0 for no limit), whether it is paid, and how many unused days carry into the next year.">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Days a year</TH>
            <TH>Carry over</TH>
            <TH>Paid</TH>
            <TH>In use</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((t, i) => (
            <TR key={t.id ?? i}>
              <TD>
                <Input value={t.name} onChange={(e) => set(i, { name: e.target.value })} />
              </TD>
              <TD>
                <Input type="number" min={0} className="w-20" value={t.daysPerYear} onChange={(e) => set(i, { daysPerYear: Number(e.target.value) })} />
              </TD>
              <TD>
                <Input type="number" min={0} className="w-20" value={t.carryForward} onChange={(e) => set(i, { carryForward: Number(e.target.value) })} />
              </TD>
              <TD>
                <Switch aria-label={`${t.name || "This kind"} is paid`} checked={t.paid} onCheckedChange={(paid) => set(i, { paid })} />
              </TD>
              <TD>
                <Switch aria-label={`${t.name || "This kind"} is in use`} checked={t.active} onCheckedChange={(active) => set(i, { active })} />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setDraft([...rows, { name: "", daysPerYear: 0, paid: true, carryForward: 0, active: true }])}>
          <Plus />
          Add a kind
        </Button>
        <Button
          disabled={!draft || act.isPending}
          onClick={() =>
            act.mutate(
              { step: "types", types: rows },
              { onSuccess: () => (setDraft(null), toast.success("Saved")), onError: (e) => toast.error(errorMessage(e)) },
            )
          }
        >
          Save
        </Button>
      </div>
    </SectionCard>
  );
}

/** /app/leave: your leave and balance; HR's approvals, everyone's balances and the kinds of leave. */
export function LiveLeave() {
  const can = useCan();
  const hr = can("hr", "view");
  const [tab, setTab] = useState(can("hr", "approve") ? "approvals" : "mine");
  const [asking, setAsking] = useState(false);
  return (
    <>
      <PageHeader
        title="Leave"
        description="Ask for leave; HR approves it seeing the shoots and due videos it clashes with. Approved leave shows on the attendance; unpaid leave comes off pay."
        actions={
          <Button onClick={() => setAsking(true)}>
            <CalendarPlus />
            Ask for leave
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList>
          {can("hr", "approve") && <TabsTrigger value="approvals">Waiting for approval</TabsTrigger>}
          <TabsTrigger value="mine">{hr ? "All leave" : "My leave"}</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          {can("hr", "edit") && <TabsTrigger value="kinds">Kinds of leave</TabsTrigger>}
        </TabsList>
      </Tabs>
      {tab === "approvals" ? (
        <Requests status="pending" decide />
      ) : tab === "mine" ? (
        <Requests status="" decide={false} />
      ) : tab === "balances" ? (
        <Balances />
      ) : (
        <LeaveKinds />
      )}
      {asking && <LeaveDialog onClose={() => setAsking(false)} />}
    </>
  );
}
