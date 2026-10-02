"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  ATTENDANCE_IMPORT_COLUMNS,
  attendanceImportRow,
  parseDateTimeDate,
  parseTimeText,
  AGREEMENT_IMPORT_COLUMNS,
  AGREEMENT_IMPORT_STATUS_LABEL,
  agreementEndDate,
  agreementImportRow,
  CLIENT_IMPORT_COLUMNS,
  clientImportRow,
  LEAD_IMPORT_COLUMNS,
  leadImportRow,
  parseAgreementStatus,
  parseDateText,
  parseDeliverables,
  parsePlatforms,
  parseRupees,
  PLATFORM_LABELS,
  type ImportColumn,
  type EmployeeRow,
  type ImportKind,
  type ImportResult,
  matchColumns,
  OWNER_ROLE,
  parseVideoStage,
  parseYesNo,
  scopeOf,
  suggestCode,
  TEAM_IMPORT_COLUMNS,
  teamImportRow,
  URGENCY_LABEL,
  VIDEO_IMPORT_COLUMNS,
  VIDEO_STAGE_LABEL,
  videoImportRow,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, inr } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { CheckReportView } from "./import-report";
import {
  useCan,
  useClients,
  useImport,
  useImports,
  useMe,
  usePackages,
  usePeople,
  useProductionSettings,
  useRoles,
  useStages,
  useTeam,
  useUndoImport,
} from "./queries";

const COLUMNS: Record<ImportKind, ImportColumn[]> = {
  clients: CLIENT_IMPORT_COLUMNS,
  team: TEAM_IMPORT_COLUMNS,
  leads: LEAD_IMPORT_COLUMNS,
  videos: VIDEO_IMPORT_COLUMNS,
  agreements: AGREEMENT_IMPORT_COLUMNS,
  attendance: ATTENDANCE_IMPORT_COLUMNS,
};
const MAX_ROWS: Record<ImportKind, number> = { clients: 1000, team: 500, leads: 2000, videos: 2000, agreements: 1000, attendance: 60000 };
const WHAT: Record<ImportKind, string> = { clients: "clients", team: "people", leads: "leads", videos: "videos", agreements: "agreements", attendance: "days" };
const ONE: Record<ImportKind, string> = { clients: "client", team: "person", leads: "lead", videos: "video", agreements: "agreement", attendance: "day" };
const count = (n: number, kind: ImportKind) => `${n} ${n === 1 ? ONE[kind] : WHAT[kind]}`;
const AREA = { clients: "clients", team: "team", leads: "crm", videos: "production", agreements: "agreements", attendance: "hr" } as const;
const DONE_LINK: Record<ImportKind, { href: string; label: string }> = {
  clients: { href: "/app/clients", label: "See the clients" },
  team: { href: "/app/settings/team", label: "See the team" },
  leads: { href: "/app/sales", label: "See the pipeline" },
  videos: { href: "/app/production?tab=sheet", label: "See the videos" },
  agreements: { href: "/app/agreements", label: "See the agreements" },
  attendance: { href: "/app/attendance", label: "See the attendance" },
};
/** The API's field names for videos, as the importer's columns. */
const VIDEO_PATHS: Record<string, string> = { clientCode: "client", editorEmail: "editor" };
/** The API's field names for agreements, as the importer's columns. */
const AGREEMENT_PATHS: Record<string, string> = { clientCode: "client", packageId: "package", revisionsPerDeliverable: "revisions" };
const URGENCY_WORDS: Record<string, "rush" | "priority" | "standard"> = {
  rush: "rush",
  urgent: "rush",
  asap: "rush",
  priority: "priority",
  high: "priority",
  standard: "standard",
  normal: "standard",
  regular: "standard",
};

interface Sheet {
  fileName: string;
  headers: string[];
  rows: string[][];
}
interface PreviewRow {
  /** Row number in the file (the heading is row 1). */
  line: number;
  values: Record<string, string>;
  issues: Record<string, string>;
  payload: unknown;
}

// ─── Reading the file (in the browser; it is never uploaded) ─────────

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v).trim();
}

async function readFile(file: File): Promise<Sheet> {
  let table: string[][];
  if (/\.csv$/i.test(file.name)) {
    const parsed = Papa.parse<unknown[]>(await file.text(), { skipEmptyLines: "greedy" });
    table = parsed.data.map((r) => r.map(cellText));
  } else if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    table = (await readSheet(file)).map((r) => r.map(cellText));
  } else {
    throw new Error("Use an Excel file (.xlsx) or a CSV file. In Excel: File → Save a copy → Excel Workbook (.xlsx).");
  }
  const start = table.findIndex((r) => r.some(Boolean));
  if (start === -1) throw new Error("The file is empty.");
  const headers = table[start]!.map((h, i) => h || `Column ${i + 1}`);
  const rows = table.slice(start + 1).filter((r) => r.some(Boolean));
  return { fileName: file.name, headers, rows: rows.map((r) => headers.map((_, i) => r[i] ?? "")) };
}

async function downloadTemplate(kind: ImportKind) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const columns = COLUMNS[kind];
  await writeXlsxFile([columns.map((c) => ({ value: c.label, fontWeight: "bold" as const })), columns.map((c) => c.example)], {
    columns: columns.map(() => ({ width: 26 })),
  }).toFile(`genie-${kind}-template.xlsx`);
}

// ─── Checking the rows (the same rules the API applies) ──────────────

const CLIENT_PATHS: Record<string, string> = {
  name: "name",
  code: "code",
  industry: "industry",
  city: "city",
  "contacts.0.name": "contactName",
  "contacts.0.phone": "contactPhone",
  "contacts.0.email": "contactEmail",
  "contacts.0.title": "contactTitle",
  accountOwnerEmail: "accountOwnerEmail",
  contacts: "contactName",
};

function useClientRows(sheet: Sheet | null, mapping: Record<string, number | null>) {
  const clients = useClients();
  const team = useTeam();
  return useMemo(() => {
    if (!sheet || !clients.data || !team.data) return null;
    const existing = new Map(clients.data.map((c) => [c.code, c.name]));
    const names = new Set(clients.data.map((c) => c.name.toLowerCase()));
    const members = new Set(team.data.members.map((m) => m.user.email.toLowerCase()));
    const taken = new Set(existing.keys());
    const inFile = new Map<string, number>();

    return sheet.rows.map((r, i): PreviewRow => {
      const get = (k: string) => (mapping[k] == null ? "" : (r[mapping[k]!] ?? "").trim());
      const values: Record<string, string> = Object.fromEntries(CLIENT_IMPORT_COLUMNS.map((c) => [c.key, get(c.key)]));
      const issues: Record<string, string> = {};
      let code = values.code!.toUpperCase().replace(/\s+/g, "");
      if (!code && values.name) code = suggestCode(values.name, taken);
      values.code = code;
      const payload = {
        name: values.name,
        code,
        industry: values.industry || undefined,
        city: values.city || undefined,
        contacts: [
          {
            name: values.contactName,
            phone: values.contactPhone,
            email: values.contactEmail || undefined,
            title: values.contactTitle || undefined,
            approver: parseYesNo(values.approver ?? "") ?? true,
          },
        ],
        accountOwnerEmail: values.accountOwnerEmail || undefined,
      };
      const parsed = clientImportRow.safeParse(payload);
      if (!parsed.success) for (const issue of parsed.error.issues) issues[CLIENT_PATHS[issue.path.join(".")] ?? "name"] ??= issue.message;
      if (existing.has(code)) issues.code ??= `Code ${code} is already used by ${existing.get(code)}`;
      else if (inFile.has(code)) issues.code ??= `Same code as row ${inFile.get(code)}`;
      if (values.name && names.has(values.name.toLowerCase())) issues.name ??= "Already in your clients";
      if (values.accountOwnerEmail && !members.has(values.accountOwnerEmail.toLowerCase())) issues.accountOwnerEmail ??= "No one in your team has this email";
      if (code && !inFile.has(code)) inFile.set(code, i + 2);
      taken.add(code);
      return { line: i + 2, values, issues, payload: parsed.success ? parsed.data : null };
    });
  }, [sheet, mapping, clients.data, team.data]);
}

function useTeamRows(sheet: Sheet | null, mapping: Record<string, number | null>) {
  const me = useMe().data;
  const team = useTeam();
  const roles = useRoles();
  return useMemo(() => {
    if (!sheet || !team.data || !roles.data) return null;
    const members = new Set(team.data.members.map((m) => m.user.email.toLowerCase()));
    const inFile = new Map<string, number>();
    const isOwner = me?.role?.key === OWNER_ROLE;
    return sheet.rows.map((r, i): PreviewRow => {
      const get = (k: string) => (mapping[k] == null ? "" : (r[mapping[k]!] ?? "").trim());
      const values = { email: get("email").toLowerCase(), role: get("role") };
      const issues: Record<string, string> = {};
      const wanted = values.role.toLowerCase();
      const role = roles.data.find((x) => x.key === wanted || x.name.toLowerCase() === wanted);
      if (!values.role) issues.role = "Choose a role";
      else if (!role) issues.role = `No role called "${values.role}"`;
      else if (role.key === OWNER_ROLE && !isOwner) issues.role = "Only an owner can make someone an owner";
      const parsed = teamImportRow.safeParse({ email: values.email, role: role?.key ?? values.role });
      if (!parsed.success) for (const issue of parsed.error.issues) issues[String(issue.path[0])] ??= issue.message;
      if (members.has(values.email)) issues.email ??= "Already in this agency";
      else if (inFile.has(values.email)) issues.email ??= `Same email as row ${inFile.get(values.email)}`;
      if (values.email && !inFile.has(values.email)) inFile.set(values.email, i + 2);
      return { line: i + 2, values: { ...values, role: role?.name ?? values.role }, issues, payload: parsed.success ? parsed.data : null };
    });
  }, [sheet, mapping, team.data, roles.data, me]);
}

function useLeadRows(sheet: Sheet | null, mapping: Record<string, number | null>) {
  const can = useCan();
  const stages = useStages();
  const team = useTeam(can("team", "view"));
  const me = useMe().data;
  return useMemo(() => {
    if (!sheet || !stages.data || (can("team", "view") && !team.data)) return null;
    const members = new Set((team.data?.members ?? []).map((m) => m.user.email.toLowerCase()).concat(me ? [me.user.email.toLowerCase()] : []));
    return sheet.rows.map((r, i): PreviewRow => {
      const get = (k: string) => (mapping[k] == null ? "" : (r[mapping[k]!] ?? "").trim());
      const values: Record<string, string> = Object.fromEntries(LEAD_IMPORT_COLUMNS.map((c) => [c.key, get(c.key)]));
      const issues: Record<string, string> = {};
      const wanted = values.stage!.toLowerCase();
      const stage = wanted ? stages.data.find((s) => s.key === wanted || s.name.toLowerCase() === wanted) : undefined;
      if (wanted && !stage) issues.stage = `No stage called "${values.stage}"`;
      const value = parseRupees(values.value!);
      if (values.value && value === undefined) issues.value = "Use a number, e.g. 60000";
      const nextFollowUp = values.nextFollowUp ? parseDateText(values.nextFollowUp) : undefined;
      if (values.nextFollowUp && !nextFollowUp) issues.nextFollowUp = "Use a date like 2026-10-05 or 05/10/2026";
      const payload = {
        name: values.name,
        company: values.company,
        phone: values.phone,
        email: values.email,
        source: values.source,
        stage: stage?.key,
        value: value ?? 0,
        ownerEmail: values.ownerEmail || undefined,
        nextFollowUp,
        notes: values.notes,
      };
      const parsed = leadImportRow.safeParse(payload);
      if (!parsed.success) for (const issue of parsed.error.issues) issues[String(issue.path[0])] ??= issue.message;
      if (values.ownerEmail && can("team", "view") && !members.has(values.ownerEmail.toLowerCase())) issues.ownerEmail ??= "No one in your team has this email";
      return { line: i + 2, values: { ...values, stage: stage?.name ?? values.stage }, issues, payload: parsed.success ? parsed.data : null };
    });
  }, [sheet, mapping, stages.data, team.data, me, can]);
}

function useVideoRows(sheet: Sheet | null, mapping: Record<string, number | null>) {
  const can = useCan();
  const clients = useClients();
  const team = useTeam(can("team", "view"));
  const settings = useProductionSettings();
  return useMemo(() => {
    if (!sheet || !clients.data || !settings.data || (can("team", "view") && !team.data)) return null;
    const byCode = new Map(clients.data.map((c) => [c.code, c]));
    const byName = new Map(clients.data.map((c) => [c.name.toLowerCase(), c]));
    const people = (team.data?.members ?? []).map((m) => m.user);
    const formats = settings.data.formats.map((f) => f.name);
    const inFile = new Map<string, number>();
    return sheet.rows.map((r, i): PreviewRow => {
      const get = (k: string) => (mapping[k] == null ? "" : (r[mapping[k]!] ?? "").trim());
      const values: Record<string, string> = Object.fromEntries(VIDEO_IMPORT_COLUMNS.map((c) => [c.key, get(c.key)]));
      const issues: Record<string, string> = {};
      const client = byCode.get(values.client!.toUpperCase()) ?? byName.get(values.client!.toLowerCase());
      if (values.client && !client) issues.client = `No client called "${values.client}"`;
      const format = values.format ? formats.find((f) => f.toLowerCase() === values.format!.toLowerCase()) : formats[0];
      if (!format) issues.format = `Not one of your formats (${formats.join(", ")})`;
      const stage = values.stage ? parseVideoStage(values.stage) : "planned";
      if (!stage) issues.stage = "Not a stage we know — e.g. Editing, QC, With client, Approved";
      const dueDate = values.dueDate ? parseDateText(values.dueDate) : undefined;
      if (values.dueDate && !dueDate) issues.dueDate = "Use a date like 2026-10-25 or 25/10/2026";
      const publishDate = values.publishDate ? parseDateText(values.publishDate) : undefined;
      if (values.publishDate && !publishDate) issues.publishDate = "Use a date like 2026-10-28 or 28/10/2026";
      const wanted = values.editor!.toLowerCase();
      const editor = wanted ? people.find((p) => p.email.toLowerCase() === wanted || p.name.toLowerCase() === wanted) : undefined;
      if (wanted && !editor && !(wanted.includes("@") && !can("team", "view"))) issues.editor = `No one called "${values.editor}" in your team`;
      const urgency = values.urgency ? URGENCY_WORDS[values.urgency.toLowerCase()] : "standard";
      if (!urgency) issues.urgency = "Rush, Priority or Standard";
      const vp = values.footageProtected ? parseYesNo(values.footageProtected) : false;
      if (vp === undefined) issues.footageProtected = "yes or no";
      const code = values.code!.toUpperCase();
      if (code && inFile.has(code)) issues.code = `Same code as row ${inFile.get(code)}`;
      else if (code) inFile.set(code, i + 2);
      const payload = {
        clientCode: client?.code ?? values.client,
        code: code || undefined,
        title: values.title,
        format: format ?? values.format,
        stage: stage ?? "planned",
        dueDate: dueDate ?? values.dueDate,
        publishDate,
        editorEmail: editor?.email ?? (wanted.includes("@") ? wanted : undefined),
        urgency: urgency ?? "standard",
        clipNo: values.clipNo || undefined,
        footageProtected: vp ?? false,
        notes: values.notes || undefined,
      };
      const parsed = videoImportRow.safeParse(payload);
      if (!parsed.success)
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          issues[VIDEO_PATHS[key] ?? key] ??= issue.message;
        }
      const shown = {
        ...values,
        client: client ? `${client.code} · ${client.name}` : values.client!,
        format: format ?? values.format!,
        stage: stage ? VIDEO_STAGE_LABEL[stage] : values.stage!,
        editor: editor?.name ?? values.editor!,
        urgency: urgency ? URGENCY_LABEL[urgency] : values.urgency!,
        footageProtected: vp ? "Yes" : vp === false && values.footageProtected ? "No" : values.footageProtected!,
      };
      return { line: i + 2, values: shown, issues, payload: parsed.success ? parsed.data : null };
    });
  }, [sheet, mapping, clients.data, team.data, settings.data, can]);
}

function useAgreementRows(sheet: Sheet | null, mapping: Record<string, number | null>) {
  const can = useCan();
  const clients = useClients();
  const packages = usePackages(true);
  return useMemo(() => {
    if (!sheet || !clients.data || !packages.data) return null;
    const byCode = new Map(clients.data.map((c) => [c.code, c]));
    const byName = new Map(clients.data.map((c) => [c.name.toLowerCase(), c]));
    const canSign = can("agreements", "approve");
    const whole = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined);
    return sheet.rows.map((r, i): PreviewRow => {
      const get = (k: string) => (mapping[k] == null ? "" : (r[mapping[k]!] ?? "").trim());
      const values: Record<string, string> = Object.fromEntries(AGREEMENT_IMPORT_COLUMNS.map((c) => [c.key, get(c.key)]));
      const issues: Record<string, string> = {};
      const client = byCode.get(values.client!.toUpperCase()) ?? byName.get(values.client!.toLowerCase());
      if (values.client && !client) issues.client = `No client called "${values.client}"`;
      const pkg = values.package ? packages.data.find((p) => p.name.toLowerCase() === values.package!.toLowerCase()) : undefined;
      if (values.package && !pkg) issues.package = `No package called "${values.package}"`;

      const startDate = values.startDate ? parseDateText(values.startDate) : undefined;
      if (values.startDate && !startDate) issues.startDate = "Use a date like 2026-07-01 or 01/07/2026";
      const months = values.months ? whole(values.months.replace(/months?/i, "")) : undefined;
      if (values.months && (!months || months > 60)) issues.months = "Whole months, 1 to 60";
      let endDate = values.endDate ? parseDateText(values.endDate) : undefined;
      if (values.endDate && !endDate) issues.endDate = "Use a date like 2027-06-30 or 30/06/2027";
      else if (!values.endDate && !values.months) issues.endDate = "Give the end date or the months";
      if (!endDate && startDate && months && !issues.months) endDate = agreementEndDate(startDate, months);

      const fee = values.monthlyFee ? parseRupees(values.monthlyFee) : pkg?.monthlyFee;
      if (values.monthlyFee && fee === undefined) issues.monthlyFee = "Use a number, e.g. 60000";
      else if (fee === undefined) issues.monthlyFee = "Give the fee, or a package";
      const deliverables = values.deliverables ? parseDeliverables(values.deliverables) : pkg?.deliverables;
      if (values.deliverables && !deliverables) issues.deliverables = "Write them like 8 Reels, 4 Posts";
      else if (!deliverables) issues.deliverables = "Give the deliverables, or a package";
      const platforms = values.platforms ? parsePlatforms(values.platforms) : (pkg?.platforms ?? []);
      if (values.platforms && !platforms) issues.platforms = "Use platform names, e.g. Instagram, YouTube";
      const status = values.status ? parseAgreementStatus(values.status) : "active";
      if (!status) issues.status = "Running, Paused, Ended or Draft";
      else if (status !== "draft" && !canSign) issues.status = "Your role cannot sign off agreements — mark it Draft";
      const shootDays = values.shootDays ? whole(values.shootDays) : (pkg?.shootDays ?? 0);
      if (shootDays === undefined) issues.shootDays = "A whole number";
      const revisions = values.revisions ? whole(values.revisions) : (pkg?.revisionsPerDeliverable ?? 2);
      if (revisions === undefined) issues.revisions = "A whole number";

      const title = values.title || [client?.name ?? values.client, pkg?.name ?? "Retainer"].join(" · ");
      const billing = values.billing || pkg?.billing || "Monthly advance";
      const payload = {
        clientCode: client?.code ?? values.client,
        title,
        packageId: pkg?.id,
        startDate: startDate ?? values.startDate,
        endDate: endDate ?? values.endDate,
        monthlyFee: fee ?? 0,
        billing,
        revisionsPerDeliverable: revisions ?? 0,
        shootDays: shootDays ?? 0,
        deliverables: deliverables ?? [],
        platforms: platforms ?? [],
        status: status ?? "active",
        notes: values.notes || undefined,
      };
      const parsed = agreementImportRow.safeParse(payload);
      if (!parsed.success)
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          issues[AGREEMENT_PATHS[key] ?? key] ??= issue.message;
        }
      const shown = {
        ...values,
        client: client ? `${client.code} · ${client.name}` : values.client!,
        title,
        package: pkg?.name ?? values.package!,
        endDate: endDate ?? values.endDate!,
        monthlyFee: fee !== undefined ? inr(fee) : values.monthlyFee!,
        deliverables: deliverables ? deliverables.map((x) => `${x.perMonth} ${x.name}`).join(", ") : values.deliverables!,
        billing,
        shootDays: shootDays !== undefined ? String(shootDays) : values.shootDays!,
        revisions: revisions !== undefined ? String(revisions) : values.revisions!,
        platforms: platforms ? platforms.map((p) => (PLATFORM_LABELS as Record<string, string>)[p] ?? p).join(", ") : values.platforms!,
        status: status ? AGREEMENT_IMPORT_STATUS_LABEL[status] : values.status!,
      };
      return { line: i + 2, values: shown, issues, payload: parsed.success ? parsed.data : null };
    });
  }, [sheet, mapping, clients.data, packages.data, can]);
}

/**
 * Attendance from the agency's export (P5-07): one row per person and day (In and Out columns), or one row per punch
 * (a time column) — then each person's first and last punch of each day are kept.
 */
function useAttendanceRows(sheet: Sheet | null, mapping: Record<string, number | null>) {
  const team = usePeople().data;
  return useMemo(() => {
    if (!sheet || !team) return null;
    const byCode = new Map(team.filter((p) => p.employeeCode).map((p) => [p.employeeCode!.toLowerCase(), p]));
    const byEmail = new Map(team.map((p) => [p.user.email.toLowerCase(), p]));
    const names = new Map<string, EmployeeRow | null>();
    for (const p of team) {
      const k = p.user.name.trim().toLowerCase();
      names.set(k, names.has(k) ? null : p);
    }
    const punches = mapping.time != null && mapping.firstIn == null;
    const out: PreviewRow[] = [];
    const days = new Map<string, { row: PreviewRow; times: string[] }>();
    sheet.rows.forEach((r, i) => {
      const get = (k: string) => (mapping[k] == null ? "" : (r[mapping[k]!] ?? "").trim());
      const raw = get("employee");
      const stamp = get("time");
      const date = get("date") ? parseDateText(get("date")) : stamp ? parseDateTimeDate(stamp) : undefined;
      const k = raw.toLowerCase();
      const person = byCode.get(k) ?? byEmail.get(k) ?? names.get(k) ?? null;
      const issues: Record<string, string> = {};
      if (!raw) issues.employee = "Who is it?";
      else if (!person)
        issues.employee = names.get(k) === null ? "Two people have this name — use their employee code" : "No one in your team has this code, email or name";
      if (!date) issues.date = "Use a date like 2026-10-05 or 05/10/2026";
      const values: Record<string, string> = {
        employee: person ? `${person.user.name}` : raw,
        date: date ?? get("date"),
        time: stamp,
        firstIn: get("firstIn"),
        lastOut: get("lastOut"),
      };
      if (Object.keys(issues).length) {
        out.push({ line: i + 2, values, issues, payload: null });
        return;
      }
      const key = `${person!.user.id}:${date}`;
      if (punches) {
        const t = parseTimeText(stamp);
        if (!t) {
          out.push({ line: i + 2, values, issues: { time: "Use a time like 09:12 or 2026-10-05 09:12" }, payload: null });
          return;
        }
        const day = days.get(key);
        if (day) day.times.push(t);
        else {
          const row: PreviewRow = { line: i + 2, values, issues: {}, payload: null };
          days.set(key, { row, times: [t] });
          out.push(row);
        }
        return;
      }
      const firstIn = values.firstIn ? parseTimeText(values.firstIn) : undefined;
      const lastOut = values.lastOut ? parseTimeText(values.lastOut) : undefined;
      if (values.firstIn && !firstIn) issues.firstIn = "Use a time like 09:12";
      if (values.lastOut && !lastOut) issues.lastOut = "Use a time like 18:40";
      const seen = days.get(key);
      if (seen) issues.date = `Same person and day as row ${seen.row.line}`;
      const row: PreviewRow = {
        line: i + 2,
        values: { ...values, firstIn: firstIn ?? values.firstIn!, lastOut: lastOut ?? values.lastOut! },
        issues,
        payload: Object.keys(issues).length ? null : attendanceImportRow.parse({ employee: raw, date, firstIn, lastOut }),
      };
      if (!seen) days.set(key, { row, times: [] });
      out.push(row);
    });
    if (punches)
      for (const { row, times } of days.values()) {
        const sorted = [...times].sort();
        const firstIn = sorted[0]!;
        const lastOut = sorted.length > 1 ? sorted.at(-1) : undefined;
        row.values = { ...row.values, time: `${sorted.length} ${sorted.length === 1 ? "punch" : "punches"}`, firstIn, lastOut: lastOut ?? "" };
        row.payload = attendanceImportRow.parse({ employee: sheet.rows[row.line - 2]![mapping.employee!]!.trim(), date: row.values.date, firstIn, lastOut });
      }
    return out;
  }, [sheet, mapping, team]);
}

// ─── Screens ──────────────────────────────────────────────────────────

function Importer({ kind }: { kind: ImportKind }) {
  const columns = COLUMNS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [leaveOut, setLeaveOut] = useState(false);
  const [serverIssues, setServerIssues] = useState<Record<number, Record<string, string>>>({});
  const [done, setDone] = useState<(ImportResult & { fileName: string }) | null>(null);
  const [dragging, setDragging] = useState(false);
  const run = useImport(kind);
  const undo = useUndoImport();

  const clientRows = useClientRows(kind === "clients" ? sheet : null, mapping);
  const teamRows = useTeamRows(kind === "team" ? sheet : null, mapping);
  const leadRows = useLeadRows(kind === "leads" ? sheet : null, mapping);
  const videoRows = useVideoRows(kind === "videos" ? sheet : null, mapping);
  const agreementRows = useAgreementRows(kind === "agreements" ? sheet : null, mapping);
  const attendanceRows = useAttendanceRows(kind === "attendance" ? sheet : null, mapping);
  const rows = useMemo(() => {
    const base = { clients: clientRows, leads: leadRows, videos: videoRows, team: teamRows, agreements: agreementRows, attendance: attendanceRows }[kind];
    return base?.map((r, i) => (serverIssues[i] ? { ...r, issues: { ...serverIssues[i], ...r.issues } } : r)) ?? null;
  }, [kind, clientRows, teamRows, leadRows, videoRows, agreementRows, attendanceRows, serverIssues]);
  const good = rows?.filter((r) => !Object.keys(r.issues).length && r.payload) ?? [];
  const bad = (rows?.length ?? 0) - good.length;
  const missingRequired = columns.filter((c) => c.required && mapping[c.key] == null && !(kind === "clients" && c.key === "code"));

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const s = await readFile(file);
      if (!s.rows.length) throw new Error("The file has headings but no rows.");
      if (s.rows.length > MAX_ROWS[kind])
        throw new Error(`The file has ${s.rows.length} rows. Import at most ${MAX_ROWS[kind]} at a time — split it into smaller files.`);
      setSheet(s);
      setMapping(matchColumns(s.headers, columns));
      setLeaveOut(false);
      setServerIssues({});
      setDone(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submit = () => {
    if (!sheet || !rows) return;
    const sent = good;
    const label = (key: string) => columns.find((c) => c.key === key)?.label ?? key;
    // For the check report: where each row is in the file, and the rows left out with what needs fixing.
    const leftOut = rows
      .filter((r) => !sent.includes(r))
      .map((r) => ({ line: r.line, problems: Object.entries(r.issues).map(([k, m]) => `${label(k)}: ${m}`) }));
    run.mutate(
      { fileName: sheet.fileName, rows: sent.map((r) => r.payload), lines: sent.map((r) => r.line), fileRows: sheet.rows.length, leftOut },
      {
        onSuccess: (r) => {
          setDone({ ...r, fileName: sheet.fileName });
          setSheet(null);
        },
        onError: (e) => {
          // Problems only the server could see (e.g. someone added the same client meanwhile): show them on their rows.
          if (e instanceof ApiError && e.body.issues) {
            const next: Record<number, Record<string, string>> = {};
            for (const issue of e.body.issues) {
              const [, idx, ...field] = issue.path.split(".");
              const row = sent[Number(idx)];
              const rowIndex = rows!.indexOf(row!);
              const key =
                kind === "clients"
                  ? (CLIENT_PATHS[field.join(".")] ?? "name")
                  : kind === "videos"
                    ? (VIDEO_PATHS[field[0] ?? ""] ?? field[0] ?? "title")
                    : kind === "agreements"
                      ? (AGREEMENT_PATHS[field[0] ?? ""] ?? field[0] ?? "client")
                      : (field[0] ?? (kind === "team" ? "email" : "name"));
              (next[rowIndex] ??= {})[key] = issue.message;
            }
            setServerIssues(next);
          }
        },
      },
    );
  };

  if (done) {
    return (
      <div className="space-y-4">
        <SectionCard title="Imported" description={`From ${done.fileName}`}>
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="size-6 text-success" />
            <p className="text-body">
              {count(done.created, kind)} {kind === "team" ? "invited — share their links from the Team page while emails are off." : "added."}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={DONE_LINK[kind].href}>{DONE_LINK[kind].label}</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/app/import/${done.id}`}>
                <ClipboardCheck />
                Check report to print
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => setDone(null)}>
              Import another file
            </Button>
            <Button
              variant="ghost"
              disabled={undo.isPending}
              onClick={() =>
                undo.mutate(done.id, {
                  onSuccess: () => {
                    toast.success("Import undone");
                    setDone(null);
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <RotateCcw />
              Undo this import
            </Button>
          </div>
        </SectionCard>
        <CheckReportView report={done.report} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="1. Your file"
        description="An Excel (.xlsx) or CSV file with one row per entry and headings in the first row. It is read on this computer; only the rows you import are sent."
        actions={
          <Button variant="secondary" size="sm" onClick={() => downloadTemplate(kind).catch((e) => toast.error(errorMessage(e)))}>
            <Download />
            Download the template
          </Button>
        }
      >
        <input ref={inputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragging ? "border-primary bg-primary-soft" : "border-border hover:border-secondary/40 hover:bg-secondary-soft",
          )}
        >
          {sheet ? <FileSpreadsheet className="size-8 text-success" /> : <Upload className="size-8 text-text-muted" />}
          <span className="text-body font-medium">{sheet ? sheet.fileName : "Choose a file, or drop it here"}</span>
          <span className="text-body text-muted-foreground">
            {sheet ? `${sheet.rows.length} rows · choose another file to start again` : `Up to ${MAX_ROWS[kind]} rows`}
          </span>
        </button>
      </SectionCard>

      {sheet && (
        <SectionCard title="2. Match your columns" description="We matched what we could from your headings. Change any that are wrong.">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {columns.map((c) => (
              <div key={c.key} className="grid grid-cols-[1fr_1fr] items-center gap-3">
                <div>
                  <div className="text-body font-medium">
                    {c.label}
                    {c.required && !(kind === "clients" && c.key === "code") && <span className="ml-0.5 text-danger">*</span>}
                  </div>
                  {c.hint && <div className="text-body text-muted-foreground">{c.hint}</div>}
                </div>
                <Select
                  aria-label={`Column for ${c.label}`}
                  value={mapping[c.key] == null ? "_none" : String(mapping[c.key])}
                  onValueChange={(v) => setMapping({ ...mapping, [c.key]: v === "_none" ? null : Number(v) })}
                  options={[{ value: "_none", label: "Not in my file" }, ...sheet.headers.map((h, i) => ({ value: String(i), label: h }))]}
                />
              </div>
            ))}
          </div>
          {missingRequired.length > 0 && (
            <Alert tone="warning" className="mt-4">
              Choose the column for {missingRequired.map((c) => c.label).join(", ")}.
            </Alert>
          )}
        </SectionCard>
      )}

      {sheet && rows && missingRequired.length === 0 && (
        <SectionCard
          title="3. Check and import"
          description={
            bad
              ? `${good.length} rows ready · ${bad} need fixing. Fix them in your file and choose it again, or leave them out.`
              : `All ${good.length} rows are ready.`
          }
          contentClassName="p-0"
        >
          <div className="max-h-[480px] overflow-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="w-16">Row</TH>
                  {columns.map((c) => (
                    <TH key={c.key}>{c.label}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {rows.slice(0, 300).map((r) => {
                  const problem = Object.keys(r.issues).length > 0;
                  return (
                    <TR key={r.line} className={cn(problem && "bg-danger-soft/40")}>
                      <TD className="text-muted-foreground">
                        {r.line} {problem ? <Badge tone="danger">Fix</Badge> : <Badge tone="success">Ready</Badge>}
                      </TD>
                      {columns.map((c) => (
                        <TD key={c.key} className="align-top">
                          <div className={cn("max-w-48 truncate", r.issues[c.key] && "font-medium text-danger")} title={r.values[c.key]}>
                            {r.values[c.key] || <span className="text-text-muted">—</span>}
                          </div>
                          {r.issues[c.key] && <div className="max-w-56 text-body text-danger">{r.issues[c.key]}</div>}
                        </TD>
                      ))}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle px-5 py-3">
            {rows.length > 300 && <span className="text-body text-muted-foreground">Showing the first 300 of {rows.length} rows; all are checked.</span>}
            {bad > 0 && (
              <label className="flex items-center gap-2 text-body">
                <Checkbox checked={leaveOut} onCheckedChange={(v) => setLeaveOut(v === true)} />
                {bad === 1 ? "Leave out the row that needs fixing" : `Leave out the ${bad} rows that need fixing`}
              </label>
            )}
            {run.error && !(run.error instanceof ApiError && run.error.body.issues) && <span className="text-body text-danger">{errorMessage(run.error)}</span>}
            <Button className="ml-auto" disabled={!good.length || (bad > 0 && !leaveOut) || run.isPending} onClick={submit}>
              {run.isPending ? "Importing…" : `Import ${count(good.length, kind)}`}
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function RecentImports() {
  const imports = useImports();
  const undo = useUndoImport();
  if (!imports.data?.length) return null;
  return (
    <SectionCard
      title="Recent imports"
      description="Each import keeps a check report to compare with your sheet. An import can be undone for 24 hours, if nothing it added has been worked on since."
      contentClassName="p-0"
    >
      <Table>
        <THead>
          <TR>
            <TH>File</TH>
            <TH>What</TH>
            <TH>By</TH>
            <TH>When</TH>
            <TH className="w-56" />
          </TR>
        </THead>
        <TBody>
          {imports.data.map((i) => (
            <TR key={i.id}>
              <TD className="font-medium">{i.fileName}</TD>
              <TD>{count(i.rowCount, i.kind)}</TD>
              <TD>{i.createdBy ?? "—"}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">
                {new Date(i.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </TD>
              <TD className="whitespace-nowrap text-right">
                {i.hasReport && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/app/import/${i.id}`}>
                      <ClipboardCheck />
                      Check report
                    </Link>
                  </Button>
                )}
                {i.undoneAt ? (
                  <Badge tone="neutral">Undone</Badge>
                ) : i.canUndo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={undo.isPending}
                    onClick={() => undo.mutate(i.id, { onSuccess: () => toast.success("Import undone"), onError: (e) => toast.error(errorMessage(e)) })}
                  >
                    <RotateCcw />
                    Undo
                  </Button>
                ) : null}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </SectionCard>
  );
}

export function LiveImport() {
  const can = useCan();
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe().data;
  const kinds = (["clients", "leads", "team", "agreements", "videos", "attendance"] as const).filter(
    (k) => can(AREA[k], "edit") && (k !== "videos" || (!!me?.permissions && scopeOf(me.permissions, "production") === "all")),
  );
  const wanted = params.get("kind");
  const kind = kinds.find((k) => k === wanted) ?? kinds[0];

  return (
    <>
      <PageHeader
        title="Import from Excel"
        description="Bring in your existing lists yourself. Every row is checked before anything is saved, each import keeps a check report, and an import can be undone for 24 hours."
      />
      {!kind ? (
        <EmptyState icon={FileSpreadsheet} title="Nothing you can import" description="Importing needs a role that can add clients or invite people." />
      ) : (
        <div className="space-y-6">
          {kinds.length > 1 && (
            <Tabs value={kind} onValueChange={(v) => router.replace(`/app/import?kind=${v}`)}>
              <TabsList>
                {kinds.includes("clients") && <TabsTrigger value="clients">Clients</TabsTrigger>}
                {kinds.includes("leads") && <TabsTrigger value="leads">Leads</TabsTrigger>}
                {kinds.includes("team") && <TabsTrigger value="team">Team</TabsTrigger>}
                {kinds.includes("agreements") && <TabsTrigger value="agreements">Agreements</TabsTrigger>}
                {kinds.includes("attendance") && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
                {kinds.includes("videos") && <TabsTrigger value="videos">Videos in progress</TabsTrigger>}
              </TabsList>
            </Tabs>
          )}
          <Importer key={kind} kind={kind} />
          <RecentImports />
        </div>
      )}
    </>
  );
}
