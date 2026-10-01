"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import {
  CLIENT_IMPORT_COLUMNS,
  clientImportRow,
  LEAD_IMPORT_COLUMNS,
  leadImportRow,
  parseDateText,
  parseRupees,
  type ImportColumn,
  type ImportKind,
  type ImportResult,
  matchColumns,
  OWNER_ROLE,
  parseYesNo,
  suggestCode,
  TEAM_IMPORT_COLUMNS,
  teamImportRow,
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
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { useCan, useClients, useImport, useImports, useMe, useRoles, useStages, useTeam, useUndoImport } from "./queries";

const COLUMNS: Record<ImportKind, ImportColumn[]> = { clients: CLIENT_IMPORT_COLUMNS, team: TEAM_IMPORT_COLUMNS, leads: LEAD_IMPORT_COLUMNS };
const MAX_ROWS: Record<ImportKind, number> = { clients: 1000, team: 500, leads: 2000 };
const WHAT: Record<ImportKind, string> = { clients: "clients", team: "people", leads: "leads" };
const ONE: Record<ImportKind, string> = { clients: "client", team: "person", leads: "lead" };
const count = (n: number, kind: ImportKind) => `${n} ${n === 1 ? ONE[kind] : WHAT[kind]}`;
const AREA = { clients: "clients", team: "team", leads: "crm" } as const;
const DONE_LINK: Record<ImportKind, { href: string; label: string }> = {
  clients: { href: "/app/clients", label: "See the clients" },
  team: { href: "/app/settings/team", label: "See the team" },
  leads: { href: "/app/sales", label: "See the pipeline" },
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
  await writeXlsxFile(
    [columns.map((c) => ({ value: c.label, fontWeight: "bold" as const })), columns.map((c) => c.example)],
    { columns: columns.map(() => ({ width: 26 })) },
  ).toFile(`genie-${kind}-template.xlsx`);
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
  const rows = useMemo(() => {
    const base = kind === "clients" ? clientRows : kind === "leads" ? leadRows : teamRows;
    return base?.map((r, i) => (serverIssues[i] ? { ...r, issues: { ...serverIssues[i], ...r.issues } } : r)) ?? null;
  }, [kind, clientRows, teamRows, leadRows, serverIssues]);
  const good = rows?.filter((r) => !Object.keys(r.issues).length && r.payload) ?? [];
  const bad = (rows?.length ?? 0) - good.length;
  const missingRequired = columns.filter((c) => c.required && mapping[c.key] == null && !(kind === "clients" && c.key === "code"));

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const s = await readFile(file);
      if (!s.rows.length) throw new Error("The file has headings but no rows.");
      if (s.rows.length > MAX_ROWS[kind]) throw new Error(`The file has ${s.rows.length} rows. Import at most ${MAX_ROWS[kind]} at a time — split it into smaller files.`);
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
    if (!sheet) return;
    const sent = good;
    run.mutate(
      { fileName: sheet.fileName, rows: sent.map((r) => r.payload) },
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
              const key = kind === "clients" ? (CLIENT_PATHS[field.join(".")] ?? "name") : (field[0] ?? (kind === "team" ? "email" : "name"));
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
          description={bad ? `${good.length} rows ready · ${bad} need fixing. Fix them in your file and choose it again, or leave them out.` : `All ${good.length} rows are ready.`}
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
                Leave out the {bad} rows that need fixing
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
    <SectionCard title="Recent imports" description="An import can be undone for 24 hours, if nothing it added has been worked on since." contentClassName="p-0">
      <Table>
        <THead>
          <TR>
            <TH>File</TH>
            <TH>What</TH>
            <TH>By</TH>
            <TH>When</TH>
            <TH className="w-32" />
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
              <TD className="text-right">
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
  const kinds = (["clients", "leads", "team"] as const).filter((k) => can(AREA[k], "edit"));
  const wanted = params.get("kind");
  const kind = kinds.find((k) => k === wanted) ?? kinds[0];

  return (
    <>
      <PageHeader title="Import from Excel" description="Bring in your existing lists yourself. Every row is checked before anything is saved, and an import can be undone for 24 hours." />
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
