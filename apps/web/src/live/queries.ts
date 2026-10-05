"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  OWNER_ROLE,
  type AgencyProfile,
  type AgencyProfileInput,
  type Agreement,
  type AgreementEnding,
  type AgreementInput,
  type AgreementRenewal,
  type AgreementUpdate,
  type ClientDetail,
  type AnswerValue,
  type ChangeRequestInput,
  type ChangeRequestRow,
  type ClientDecision,
  type ContentInput,
  type ContentItem,
  type ContentUpdate,
  type CycleRow,
  type CalendarEvent,
  type ClientRequestRow,
  type JobOverview,
  type PaymentSettings,
  type MonthlyReport,
  type ReportRow,
  type WhatsAppMessageRow,
  type WhatsAppSettings,
  type PortalLinkRow,
  type SetupStatus,
  type JobRow,
  type PlatformConnectionRow,
  type SocialAccountChoice,
  type SocialSettings,
  type PostInput,
  type ProductionSettings,
  type ProductionSettingsInput,
  type PublishedInput,
  type PublishingItem,
  type QuotaRow,
  type ScriptInput,
  type ShootDetail,
  type ShootInput,
  type ShootSummary,
  type TopicList,
  type VersionInput,
  type VideoDetail,
  type VideoInput,
  type VideoStageKey,
  type VideoSummary,
  type VideoUpdate,
  type NotificationList,
  type NotificationPreferences,
  type StoredFile,
  type OnboardingDetail,
  type OnboardingSummary,
  type QuestionnaireDefinition,
  type QuestionnaireKind,
  type QuestionnaireVersions,
  type Invoice,
  type InvoiceInput,
  type InvoicePayment,
  type InvoiceSettings,
  type InvoiceSettingsInput,
  type InvoiceUpdate,
  type ClientUpdate,
  type ContactInput,
  type ContactUpdate,
  allows,
  type AreaKey,
  type AuditPage,
  type Client,
  type ClientInput,
  type CreatedInvitation,
  type ActivityInput,
  type ImportKind,
  type Lead,
  type LeadDetail,
  type LeadInput,
  type LeadUpdate,
  type PipelineInput,
  type PipelineStage,
  type Proposal,
  type ProposalInput,
  type WinInput,
  type AiSettingsInput,
  type AiUsageSummary,
  type AskConversationRow,
  type ClientCostRow,
  type CostingSummary,
  type CostRateInput,
  type CostRateRow,
  type CostSettings,
  type CostSettingsInput,
  type AgeingReport,
  type AttendanceCorrectionInput,
  type AttendanceCorrectionRow,
  type AttendanceMonth,
  type AttendanceSettings,
  type EmployeeBankInput,
  type EmployeeInput,
  type EmployeeRow,
  type LeaveBalanceRow,
  type LeaveRequestInput,
  type LeaveRequestRow,
  type LeaveTypeRow,
  type ClientDiagnosticRow,
  type DiagnosticInput,
  type DiagnosticView,
  type PlannerData,
  type AssetDetail,
  type ChoosePlanResult,
  type PlanCurrency,
  type PlanPage,
  type PlatformInvoiceRow,
  type SupportGrantInput,
  type DataExportRow,
  type PortalDomain,
  type TicketDetail,
  type TicketInput,
  type TicketRow,
  type SampleData,
  type SampleRemoved,
  type SetupWizard,
  type SupportGrantRow,
  type PlatformAgencyRow,
  type PlatformSettings,
  type ProjectDetail,
  type ProjectInput,
  type ProjectRow,
  type ProjectSettingsInput,
  type ProjectTemplate,
  type TaskInput,
  type TaskRow,
  type TaskStatus,
  type AssetInput,
  type AssetPerson,
  type AssetReservationRow,
  type AssetRow,
  type AssetShootRef,
  type BackInServiceInput,
  type CheckOutInput,
  type MaintenanceInput,
  type ReservationInput,
  type ReturnInput,
  type FitmentQuadrant,
  type RoadMapInput,
  type RoadMapRow,
  type ScenarioInput,
  type ScenarioInputs,
  type ScenarioRow,
  type SopInput,
  type SopRow,
  type SopRunInput,
  type SopRunRow,
  type SopVersionInput,
  type RtFeedback,
  type RtSessionInput,
  type RtSessionRow,
  type CadenceInput,
  type CadenceRow,
  type CommitmentInput,
  type CommitmentRow,
  type DecisionInput,
  type DecisionRow,
  type MeetingInput,
  type MeetingRow,
  type MeetingUpdate,
  type ReviewCadence,
  type CascadeInputs,
  type CascadeView,
  type CheckInInput,
  type GoalInput,
  type GoalRow,
  type GoalSettings,
  type DailySheetRow,
  type SheetInput,
  type SheetSettings,
  type SheetTeamRow,
  type SheetTemplate,
  type SheetTemplateInput,
  type KraTemplateInput,
  type KraTemplateRow,
  type LeaderboardRow,
  type LearningAssignmentRow,
  type LearningPathInput,
  type LearningPathRow,
  type MonthScorecardRow,
  type PerformanceSettings,
  type PlayerRatingInput,
  type PlayerRatingRow,
  type SkillMatrix,
  type TeamMemberRow,
  type CandidateInput,
  type CandidateRow,
  type CandidateStage,
  type HiringSettings,
  type InterviewInput,
  type OfferInput,
  type OpeningInput,
  type OpeningRow,
  type ScorecardInput,
  type PayrollRunRow,
  type PayrollSettings,
  type PayrollSettingsInput,
  type PayslipChange,
  type PayslipRow,
  type SalaryInput,
  type SalaryRow,
  type FinanceMonthRow,
  type ExpenseInput,
  type ExpenseRow,
  type VideoCostRow,
  type DraftRequest,
  type DraftRow,
  type GenieEvaluation,
  type GenieRulesInput,
  type GenieSettings,
  type ImportDetail,
  type InsightRow,
  type ImportRecord,
  type ImportResult,
  type Me,
  type Package,
  type PackageInput,
  type PermissionLevel,
  type PermissionMatrix,
  type Role,
  type Team,
  type TestPerson,
  type TimeEntryRow,
} from "@gm/shared";
import { api, ApiError } from "./api";

export const keys = {
  me: ["me"] as const,
  team: ["team"] as const,
  roles: ["roles"] as const,
  clients: ["clients"] as const,
  audit: (query: string) => ["audit", query] as const,
  testPeople: ["test-people"] as const,
  agency: ["agency"] as const,
  packages: ["packages"] as const,
  imports: ["imports"] as const,
  stages: ["pipeline-stages"] as const,
  leads: ["leads"] as const,
  agreements: ["agreements"] as const,
  invoices: ["invoices"] as const,
  invoiceSettings: ["invoice-settings"] as const,
  onboarding: ["onboarding"] as const,
  questionnaires: ["questionnaires"] as const,
  notifications: ["notifications"] as const,
  files: ["files"] as const,
  videos: ["videos"] as const,
  content: ["content"] as const,
  topicLists: ["topic-lists"] as const,
  shoots: ["shoots"] as const,
  publishing: ["publishing"] as const,
  cycles: ["cycles"] as const,
  changeRequests: ["change-requests"] as const,
  productionSettings: ["production-settings"] as const,
  jobs: ["jobs"] as const,
};

// ─── Session ──────────────────────────────────────────────────────────

/** Who is signed in and where. `null` when not signed in. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<Me>("/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
  });
}

/** Whether a feature flag the platform's team switched on is on for the active agency (P6-09). */
export function useFlag(key: string) {
  return !!useMe().data?.flags.includes(key);
}

/** `can("clients", "edit")` — the same rule the API enforces, used to hide what the person cannot do. */
export function useCan() {
  const me = useMe().data;
  return (area: AreaKey, level: Exclude<PermissionLevel, "none">) => !!me?.permissions && allows(me.permissions, area, level);
}

/** Whether the signed-in person may approve this request: someone else decides your own, unless you are the owner. */
export function useMayDecide() {
  const me = useMe().data;
  const can = useCan();
  return (area: AreaKey, requestedBy: string | null | undefined) => can(area, "approve") && (requestedBy !== me?.user.id || me?.role?.key === OWNER_ROLE);
}

/** People who can be picked on a test server; `null` when test sign-in is off. */
export function useTestPeople() {
  return useQuery({
    queryKey: keys.testPeople,
    queryFn: async () => {
      try {
        return await api<TestPerson[]>("/auth/test-sign-in/people");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    retry: false,
  });
}

/** After signing in or out, or switching agency, everything cached belongs to someone else: start fresh. */
function useFresh() {
  const qc = useQueryClient();
  return async () => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "test-people" });
    await qc.invalidateQueries({ queryKey: keys.me });
  };
}

export function useTestSignIn() {
  const fresh = useFresh();
  return useMutation({
    mutationFn: (v: { email: string; agencyId?: string }) => api("/auth/test-sign-in", { body: v }),
    onSuccess: fresh,
  });
}

export function useSignIn() {
  const fresh = useFresh();
  return useMutation({
    mutationFn: (v: { email: string; password: string }) => api("/auth/sign-in/email", { body: v }),
    onSuccess: fresh,
  });
}

export function useSignUp() {
  const fresh = useFresh();
  return useMutation({
    mutationFn: (v: { name: string; email: string; password: string }) => api("/auth/sign-up/email", { body: v }),
    onSuccess: fresh,
  });
}

// ─── Password self-service ───────────────────────────────────────────

/** Asks for a link to choose a new password; the answer is the same whether or not the address has an account. */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => api("/auth/request-password-reset", { body: { email, redirectTo: `${window.location.origin}/app/reset-password` } }),
  });
}

/** A new password, with the token from the emailed link. */
export function useResetPassword() {
  return useMutation({ mutationFn: (v: { token: string; newPassword: string }) => api("/auth/reset-password", { body: v }) });
}

/** Changing one's own password while signed in; other devices are signed out unless asked not to. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (v: { currentPassword: string; newPassword: string; revokeOtherSessions: boolean }) => api("/auth/change-password", { body: v }),
  });
}

export function useSignOut() {
  const fresh = useFresh();
  return useMutation({ mutationFn: () => api("/auth/sign-out", { body: {} }), onSuccess: fresh });
}

export function useSwitchAgency() {
  const fresh = useFresh();
  return useMutation({
    mutationFn: (organizationId: string) => api("/auth/organization/set-active", { body: { organizationId } }),
    onSuccess: fresh,
  });
}

/** A new agency: the person becomes its owner and it gets the default roles. */
export function useCreateAgency() {
  const fresh = useFresh();
  return useMutation({
    mutationFn: async (v: { name: string; slug: string }) => {
      const agency = await api<{ id: string }>("/auth/organization/create", { body: v });
      await api("/auth/organization/set-active", { body: { organizationId: agency.id } });
      return agency;
    },
    onSuccess: fresh,
  });
}

export function useAcceptInvitation() {
  const fresh = useFresh();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const r = await api<{ member: { organizationId?: string; agencyId?: string } }>("/auth/organization/accept-invitation", { body: { invitationId } });
      const agencyId = r.member.agencyId ?? r.member.organizationId;
      if (agencyId) await api("/auth/organization/set-active", { body: { organizationId: agencyId } });
    },
    onSuccess: fresh,
  });
}

// ─── Team and roles ───────────────────────────────────────────────────

export const useTeam = (enabled = true) => useQuery({ queryKey: keys.team, queryFn: () => api<Team>("/team"), enabled });
export const useRoles = () => useQuery({ queryKey: keys.roles, queryFn: () => api<Role[]>("/roles") });

function useRefresh(...queryKeys: (readonly string[])[]) {
  const qc = useQueryClient();
  return () => Promise.all([...queryKeys, keys.me].map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useInvite() {
  const refresh = useRefresh(keys.team);
  return useMutation({
    mutationFn: (v: { email: string; role: string }) => api<CreatedInvitation>("/team/invitations", { body: v }),
    onSuccess: refresh,
  });
}

export function useCancelInvitation() {
  const refresh = useRefresh(keys.team);
  return useMutation({ mutationFn: (id: string) => api(`/team/invitations/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useChangeRole() {
  const refresh = useRefresh(keys.team, keys.roles);
  return useMutation({
    mutationFn: (v: { membershipId: string; role: string }) => api(`/team/members/${v.membershipId}`, { method: "PATCH", body: { role: v.role } }),
    onSuccess: refresh,
  });
}

export function useRemoveMember() {
  const refresh = useRefresh(keys.team, keys.roles);
  return useMutation({ mutationFn: (membershipId: string) => api(`/team/members/${membershipId}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useCreateRole() {
  const refresh = useRefresh(keys.roles);
  return useMutation({
    mutationFn: (v: { name: string; description?: string; copyFrom?: string }) => api<Role>("/roles", { body: v }),
    onSuccess: refresh,
  });
}

export function useUpdateRole() {
  const refresh = useRefresh(keys.roles);
  return useMutation({
    mutationFn: (v: { key: string; name?: string; description?: string | null; permissions?: PermissionMatrix }) => {
      const { key, ...body } = v;
      return api<Role>(`/roles/${key}`, { method: "PATCH", body });
    },
    onSuccess: refresh,
  });
}

export function useDeleteRole() {
  const refresh = useRefresh(keys.roles);
  return useMutation({ mutationFn: (key: string) => api(`/roles/${key}`, { method: "DELETE" }), onSuccess: refresh });
}

// ─── Clients and audit ────────────────────────────────────────────────

export const useClients = (enabled = true) => useQuery({ queryKey: keys.clients, queryFn: () => api<Client[]>("/clients"), enabled });

export function useCreateClient() {
  const refresh = useRefresh(keys.clients);
  return useMutation({ mutationFn: (v: ClientInput) => api<Client>("/clients", { body: v }), onSuccess: refresh });
}

export const useClient = (id: string) => useQuery({ queryKey: [...keys.clients, id], queryFn: () => api<ClientDetail>(`/clients/${id}`) });

/** Client and agreement changes show on the client page, the lists and Home. */
function useRefreshClients() {
  const qc = useQueryClient();
  return () => Promise.all([keys.clients, keys.agreements, keys.invoices].map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useUpdateClient(id: string) {
  const refresh = useRefreshClients();
  return useMutation({ mutationFn: (v: ClientUpdate) => api<ClientDetail>(`/clients/${id}`, { method: "PATCH", body: v }), onSuccess: refresh });
}

export function useArchiveClient(id: string) {
  const refresh = useRefreshClients();
  return useMutation({
    mutationFn: (archived: boolean) => api<ClientDetail>(`/clients/${id}/${archived ? "archive" : "restore"}`, { body: {} }),
    onSuccess: refresh,
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: [...keys.clients, id] });
      return qc.invalidateQueries({ queryKey: keys.clients, exact: true });
    },
  });
}

export function useSaveContact(clientId: string) {
  const refresh = useRefreshClients();
  return useMutation({
    mutationFn: (v: { id?: string; input: ContactInput | ContactUpdate }) =>
      v.id
        ? api<ClientDetail>(`/clients/${clientId}/contacts/${v.id}`, { method: "PATCH", body: v.input })
        : api<ClientDetail>(`/clients/${clientId}/contacts`, { body: v.input }),
    onSuccess: refresh,
  });
}

export function useRemoveContact(clientId: string) {
  const refresh = useRefreshClients();
  return useMutation({ mutationFn: (id: string) => api<ClientDetail>(`/clients/${clientId}/contacts/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

// ─── Agreements ───────────────────────────────────────────────────────

/** `""` for all, `status=draft`, `renewal=1`… */
export const useAgreements = (query = "", enabled = true) =>
  useQuery({ queryKey: [...keys.agreements, query], queryFn: () => api<Agreement[]>(`/agreements${query ? `?${query}` : ""}`), enabled });

export function useSaveAgreement() {
  const refresh = useRefreshClients();
  return useMutation({
    mutationFn: (v: { id?: string; clientId: string; input: AgreementInput | AgreementUpdate }) =>
      v.id ? api<Agreement>(`/agreements/${v.id}`, { method: "PATCH", body: v.input }) : api<Agreement>(`/clients/${v.clientId}/agreements`, { body: v.input }),
    onSuccess: refresh,
  });
}

export type AgreementStep =
  | { step: "sign-off" | "resume" | "delete" }
  | { step: "pause"; note?: string }
  | { step: "end"; input: AgreementEnding }
  | { step: "renew"; input: AgreementRenewal };

export function useAgreementStep() {
  const refresh = useRefreshClients();
  return useMutation({
    mutationFn: ({ id, ...v }: { id: string } & AgreementStep) => {
      switch (v.step) {
        case "delete":
          return api<Agreement | undefined>(`/agreements/${id}`, { method: "DELETE" });
        case "pause":
          return api<Agreement>(`/agreements/${id}/pause`, { body: { note: v.note } });
        case "end":
        case "renew":
          return api<Agreement>(`/agreements/${id}/${v.step}`, { body: v.input });
        default:
          return api<Agreement>(`/agreements/${id}/${v.step}`, { body: {} });
      }
    },
    onSuccess: refresh,
  });
}

export function useAudit(query: string, enabled = true) {
  return useQuery({ queryKey: keys.audit(query), queryFn: () => api<AuditPage>(`/audit${query ? `?${query}` : ""}`), enabled });
}

// ─── Settings: agency profile and packages ────────────────────────────

export const useAgency = () => useQuery({ queryKey: keys.agency, queryFn: () => api<AgencyProfile>("/agency") });

export function useUpdateAgency() {
  const refresh = useRefresh(keys.agency);
  return useMutation({ mutationFn: (v: AgencyProfileInput) => api<AgencyProfile>("/agency", { method: "PATCH", body: v }), onSuccess: refresh });
}

/** Active packages, or all of them with archived ones last. */
export const usePackages = (archived = false) =>
  useQuery({ queryKey: [...keys.packages, archived], queryFn: () => api<Package[]>(`/packages${archived ? "?archived=1" : ""}`) });

export function useSavePackage() {
  const refresh = useRefresh(keys.packages);
  return useMutation({
    mutationFn: (v: { id?: string; input: PackageInput }) =>
      v.id ? api<Package>(`/packages/${v.id}`, { method: "PATCH", body: v.input }) : api<Package>("/packages", { body: v.input }),
    onSuccess: refresh,
  });
}

export function useSetPackageActive() {
  const refresh = useRefresh(keys.packages);
  return useMutation({
    mutationFn: (v: { id: string; active: boolean }) => api<Package>(`/packages/${v.id}/${v.active ? "restore" : "archive"}`, { body: {} }),
    onSuccess: refresh,
  });
}

export function useDeletePackage() {
  const refresh = useRefresh(keys.packages);
  return useMutation({ mutationFn: (id: string) => api(`/packages/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

// ─── Imports ──────────────────────────────────────────────────────────

export const useImports = () => useQuery({ queryKey: keys.imports, queryFn: () => api<ImportRecord[]>("/imports") });

/** One import with its check report. */
export const useImportDetail = (id: string) => useQuery({ queryKey: [...keys.imports, id], queryFn: () => api<ImportDetail>(`/imports/${id}`) });

export function useImport(kind: ImportKind) {
  const refresh = useRefresh(keys.imports, keys.clients, keys.team, keys.leads, keys.videos, keys.cycles, keys.agreements, ["attendance"]);
  return useMutation({
    mutationFn: (v: { fileName: string; rows: unknown[]; lines: number[]; fileRows?: number; leftOut: { line: number; problems: string[] }[] }) =>
      api<ImportResult>(`/imports/${kind}`, { body: v }),
    onSuccess: refresh,
  });
}

export function useUndoImport() {
  const refresh = useRefresh(keys.imports, keys.clients, keys.team, keys.leads, keys.videos, keys.cycles, keys.agreements, ["attendance"]);
  return useMutation({ mutationFn: (id: string) => api<{ removed: number; kept: number }>(`/imports/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

// ─── Sales pipeline ───────────────────────────────────────────────────

export const useStages = () => useQuery({ queryKey: keys.stages, queryFn: () => api<PipelineStage[]>("/pipeline/stages") });

export function useSaveStages() {
  const refresh = useRefresh(keys.stages, keys.leads);
  return useMutation({ mutationFn: (v: PipelineInput) => api<PipelineStage[]>("/pipeline/stages", { method: "PUT", body: v }), onSuccess: refresh });
}

export const useLeads = (enabled = true) => useQuery({ queryKey: keys.leads, queryFn: () => api<Lead[]>("/leads"), enabled });

export const useLead = (id: string | null) => useQuery({ queryKey: [...keys.leads, id], queryFn: () => api<LeadDetail>(`/leads/${id}`), enabled: !!id });

export function useSaveLead() {
  const refresh = useRefresh(keys.leads);
  return useMutation({
    mutationFn: (v: { id?: string; input: LeadInput | LeadUpdate }) =>
      v.id ? api<LeadDetail>(`/leads/${v.id}`, { method: "PATCH", body: v.input }) : api<LeadDetail>("/leads", { body: v.input }),
    onSuccess: refresh,
  });
}

/** Moving a card on the board: shown at once, put back if the server refuses. */
export function useMoveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; stage: string }) => api<LeadDetail>(`/leads/${v.id}`, { method: "PATCH", body: { stage: v.stage } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.leads });
      const before = qc.getQueryData<Lead[]>(keys.leads);
      qc.setQueryData<Lead[]>(keys.leads, (leads) => leads?.map((l) => (l.id === v.id ? { ...l, stage: v.stage } : l)));
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before && qc.setQueryData(keys.leads, ctx.before),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.leads }),
  });
}

export function useDeleteLead() {
  const refresh = useRefresh(keys.leads);
  return useMutation({ mutationFn: (id: string) => api(`/leads/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

export function useAddActivity() {
  const refresh = useRefresh(keys.leads);
  return useMutation({
    mutationFn: (v: { leadId: string; input: ActivityInput }) => api<LeadDetail>(`/leads/${v.leadId}/activities`, { body: v.input }),
    onSuccess: refresh,
  });
}

// ─── Proposals and winning ────────────────────────────────────────────

export const useProposals = (status: string, enabled = true) =>
  useQuery({ queryKey: ["proposals", status], queryFn: () => api<(Proposal & { leadName: string })[]>(`/proposals?status=${status}`), enabled });

function useRefreshDeals() {
  const qc = useQueryClient();
  return () => Promise.all([keys.leads, ["proposals"], keys.clients, keys.agreements, keys.me].map((queryKey) => qc.invalidateQueries({ queryKey })));
}

export function useCreateProposal() {
  const refresh = useRefreshDeals();
  return useMutation({
    mutationFn: (v: { leadId: string; input: ProposalInput }) => api<Proposal>(`/leads/${v.leadId}/proposals`, { body: v.input }),
    onSuccess: refresh,
  });
}

/** approve · reject (with a note) · sent · accepted · declined */
export function useProposalStep() {
  const refresh = useRefreshDeals();
  return useMutation({
    mutationFn: (v: { id: string; step: "approve" | "reject" | "sent" | "accepted" | "declined"; note?: string }) =>
      v.step === "accepted" || v.step === "declined"
        ? api<Proposal>(`/proposals/${v.id}/answer`, { body: { accepted: v.step === "accepted", note: v.note } })
        : api<Proposal>(`/proposals/${v.id}/${v.step}`, { body: v.step === "sent" ? {} : { note: v.note } }),
    onSuccess: refresh,
  });
}

export function useWinLead() {
  const refresh = useRefreshDeals();
  return useMutation({
    mutationFn: (v: { leadId: string; input: WinInput }) => api<{ clientId: string; agreementId: string | null }>(`/leads/${v.leadId}/win`, { body: v.input }),
    onSuccess: refresh,
  });
}

// ─── Invoices ─────────────────────────────────────────────────────────

/** Null until the agency sets them up. */
export const useInvoiceSettings = (enabled = true) =>
  useQuery({ queryKey: keys.invoiceSettings, queryFn: async () => (await api<InvoiceSettings | null>("/invoice-settings")) ?? null, enabled });

export function useSaveInvoiceSettings() {
  const refresh = useRefresh(keys.invoiceSettings, keys.invoices);
  return useMutation({ mutationFn: (v: InvoiceSettingsInput) => api<InvoiceSettings>("/invoice-settings", { method: "PUT", body: v }), onSuccess: refresh });
}

/** `""` for all, `status=draft`, `overdue=1`, `clientId=…` */
export const useInvoices = (query = "", enabled = true) =>
  useQuery({ queryKey: [...keys.invoices, query], queryFn: () => api<Invoice[]>(`/invoices${query ? `?${query}` : ""}`), enabled });

export const useInvoice = (id: string) => useQuery({ queryKey: [...keys.invoices, "one", id], queryFn: () => api<Invoice>(`/invoices/${id}`) });

export function useSaveInvoice() {
  const refresh = useRefresh(keys.invoices);
  return useMutation({
    mutationFn: (v: { id?: string; input: InvoiceInput | InvoiceUpdate }) =>
      v.id ? api<Invoice>(`/invoices/${v.id}`, { method: "PATCH", body: v.input }) : api<Invoice>("/invoices", { body: v.input }),
    onSuccess: refresh,
  });
}

export function useInvoiceAgreementMonth() {
  const refresh = useRefresh(keys.invoices);
  return useMutation({
    mutationFn: (v: { agreementId: string; period: string }) => api<Invoice>(`/agreements/${v.agreementId}/invoices`, { body: { period: v.period } }),
    onSuccess: refresh,
  });
}

export type InvoiceStep =
  { step: "issue"; issueDate?: string } | { step: "paid"; input: InvoicePayment } | { step: "cancel"; reason: string } | { step: "delete" };

export function useInvoiceStep() {
  const refresh = useRefresh(keys.invoices);
  return useMutation({
    mutationFn: ({ id, ...v }: { id: string } & InvoiceStep) => {
      switch (v.step) {
        case "issue":
          return api<Invoice>(`/invoices/${id}/issue`, { body: { issueDate: v.issueDate } });
        case "paid":
          return api<Invoice>(`/invoices/${id}/paid`, { body: v.input });
        case "cancel":
          return api<Invoice>(`/invoices/${id}/cancel`, { body: { reason: v.reason } });
        default:
          return api<Invoice | undefined>(`/invoices/${id}`, { method: "DELETE" });
      }
    },
    onSuccess: refresh,
  });
}

// ─── Onboarding ───────────────────────────────────────────────────────

export const useQuestionnaire = (kind: QuestionnaireKind) =>
  useQuery({ queryKey: [...keys.questionnaires, kind], queryFn: () => api<QuestionnaireVersions>(`/questionnaires/${kind}`) });

export function useQuestionnaireStep(kind: QuestionnaireKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "save"; definition: QuestionnaireDefinition } | { step: "publish" | "discard" }) =>
      v.step === "save"
        ? api<QuestionnaireVersions>(`/questionnaires/${kind}/draft`, { method: "PUT", body: v.definition })
        : v.step === "publish"
          ? api<QuestionnaireVersions>(`/questionnaires/${kind}/publish`, { body: {} })
          : api<QuestionnaireVersions>(`/questionnaires/${kind}/draft`, { method: "DELETE" }),
    onSuccess: (data) => qc.setQueryData([...keys.questionnaires, kind], data),
  });
}

export const useOnboardingList = (enabled = true) => useQuery({ queryKey: keys.onboarding, queryFn: () => api<OnboardingSummary[]>("/onboarding"), enabled });

export const useOnboarding = (id: string) => useQuery({ queryKey: [...keys.onboarding, id], queryFn: () => api<OnboardingDetail>(`/onboarding/${id}`) });

/** Null before the agency starts its own questionnaire. */
export const useAgencyOnboarding = (enabled = true) =>
  useQuery({ queryKey: [...keys.onboarding, "agency"], queryFn: async () => (await api<OnboardingDetail | null>("/onboarding/agency")) ?? null, enabled });

export function useStartAgencyOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<OnboardingDetail>("/onboarding/agency", { body: {} }),
    onSuccess: (data) => qc.setQueryData([...keys.onboarding, "agency"], data),
  });
}

/** Anything changed on one onboarding: refresh it, the list, and the client page. */
function useOnboardingResult() {
  const qc = useQueryClient();
  return (data: OnboardingDetail) => {
    qc.setQueryData([...keys.onboarding, data.id], data);
    return Promise.all([keys.onboarding, keys.clients].map((queryKey) => qc.invalidateQueries({ queryKey, exact: queryKey === keys.onboarding })));
  };
}

export function useStartOnboarding() {
  const done = useOnboardingResult();
  return useMutation({
    mutationFn: (v: { clientId: string; mode?: "link" | "assisted" }) => api<OnboardingDetail>(`/clients/${v.clientId}/onboarding`, { body: { mode: v.mode } }),
    onSuccess: done,
  });
}

export function useOnboardingLink() {
  const done = useOnboardingResult();
  return useMutation({
    mutationFn: (id: string) => api<{ link: string; onboarding: OnboardingDetail }>(`/onboarding/${id}/link`, { body: {} }),
    onSuccess: (r) => done(r.onboarding),
  });
}

export type OnboardingStep =
  | { step: "update"; mode?: "link" | "assisted"; language?: string }
  | { step: "tick"; key: string; done: boolean }
  | { step: "exception"; reason: string }
  | { step: "reminder"; day: number; channel?: "whatsapp" | "email" | "in_app" };

export function useOnboardingStep(id: string) {
  const done = useOnboardingResult();
  return useMutation({
    mutationFn: (v: OnboardingStep) => {
      switch (v.step) {
        case "update":
          return api<OnboardingDetail>(`/onboarding/${id}`, { method: "PATCH", body: { mode: v.mode, language: v.language } });
        case "tick":
          return api<OnboardingDetail>(`/onboarding/${id}/checklist/${v.key}`, { method: "PUT", body: { done: v.done } });
        case "exception":
          return api<OnboardingDetail>(`/onboarding/${id}/exception`, { body: { reason: v.reason } });
        case "reminder":
          return api<OnboardingDetail>(`/onboarding/${id}/reminders`, { body: { day: v.day, channel: v.channel ?? "whatsapp" } });
      }
    },
    onSuccess: done,
  });
}

/** Saving one answer given in the agency (assisted, or the agency's own questionnaire). */
export function useSaveAnswer(id: string) {
  const done = useOnboardingResult();
  return (key: string, value: AnswerValue) => api<OnboardingDetail>(`/onboarding/${id}/answers/${key}`, { method: "PUT", body: { value } }).then(done);
}

export function usePackagesFromAnswers(id: string) {
  const refresh = useRefresh(keys.packages);
  return useMutation({ mutationFn: () => api<{ added: string[] }>(`/onboarding/${id}/packages`, { body: {} }), onSuccess: refresh });
}

// ─── Notifications ────────────────────────────────────────────────────

/** Checked every minute while the app is open. */
export const useNotifications = () =>
  useQuery({ queryKey: keys.notifications, queryFn: () => api<NotificationList>("/notifications"), refetchInterval: 60_000 });

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => api<NotificationList>("/notifications/read", { body: { ids } }),
    onSuccess: (data) => qc.setQueryData(keys.notifications, data),
  });
}

export const useNotificationPreferences = () =>
  useQuery({ queryKey: [...keys.notifications, "preferences"], queryFn: () => api<NotificationPreferences>("/notifications/preferences") });

export function useSaveNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: NotificationPreferences) => api<NotificationPreferences>("/notifications/preferences", { method: "PUT", body: v }),
    onSuccess: (data) => qc.setQueryData([...keys.notifications, "preferences"], data),
  });
}

// ─── Files ────────────────────────────────────────────────────────────

export const useFiles = (entity: string, entityId: string, enabled = true) =>
  useQuery({ queryKey: [...keys.files, entity, entityId], queryFn: () => api<StoredFile[]>(`/files?entity=${entity}&entityId=${entityId}`), enabled });

export function useDeleteFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/files/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.files }),
  });
}

// ─── Production (Phase 2) ─────────────────────────────────────────────

/** Production changes ripple: videos, content, shoots, publishing, cycles and the revisions list. */
function useRefreshProduction() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [
        keys.videos,
        keys.content,
        keys.topicLists,
        keys.shoots,
        keys.publishing,
        keys.cycles,
        keys.changeRequests,
        keys.notifications,
        ["calendar"],
        ["time"],
      ].map((queryKey) => qc.invalidateQueries({ queryKey })),
    );
}

export const useProductionSettings = () => useQuery({ queryKey: keys.productionSettings, queryFn: () => api<ProductionSettings>("/production-settings") });

export function useSaveProductionSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: ProductionSettingsInput) => api<ProductionSettings>("/production-settings", { method: "PUT", body: v }),
    onSuccess: (data) => qc.setQueryData(keys.productionSettings, data),
  });
}

export const useVideos = (query = "", enabled = true) =>
  useQuery({ queryKey: [...keys.videos, query], queryFn: () => api<VideoSummary[]>(`/videos${query ? `?${query}` : ""}`), enabled });

export const useVideo = (id: string) => useQuery({ queryKey: [...keys.videos, "one", id], queryFn: () => api<VideoDetail>(`/videos/${id}`) });

/** Any change to one video: the page refreshes from the answer, the lists in the background. */
export function useVideoAction(id: string) {
  const qc = useQueryClient();
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { path: string; method?: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }) =>
      api<VideoDetail>(`/videos/${id}${v.path}`, { method: v.method ?? "POST", body: v.method === "DELETE" ? undefined : (v.body ?? {}) }),
    onSuccess: (data) => {
      if (data) qc.setQueryData([...keys.videos, "one", id], data);
      return refresh();
    },
  });
}

export function useCreateVideo() {
  const refresh = useRefreshProduction();
  return useMutation({ mutationFn: (v: VideoInput) => api<VideoDetail>("/videos", { body: v }), onSuccess: refresh });
}

/** Moving a card on the board: shown at once, put back if the checks refuse it. */
export function useMoveVideo() {
  const qc = useQueryClient();
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { id: string; to: VideoStageKey; note?: string }) => api<VideoDetail>(`/videos/${v.id}/move`, { body: { to: v.to, note: v.note } }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.videos });
      const before = qc.getQueriesData<VideoSummary[]>({ queryKey: keys.videos });
      qc.setQueriesData<VideoSummary[]>({ queryKey: keys.videos }, (list) =>
        Array.isArray(list) ? list.map((x) => (x.id === v.id ? { ...x, stage: v.to } : x)) : list,
      );
      return { before };
    },
    onError: (_e, _v, ctx) => ctx?.before.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: refresh,
  });
}

export const useChangeRequests = (status = "", enabled = true) =>
  useQuery({
    queryKey: [...keys.changeRequests, status],
    queryFn: () => api<ChangeRequestRow[]>(`/change-requests${status ? `?status=${status}` : ""}`),
    enabled,
  });

export function useCreateChangeRequest() {
  const qc = useQueryClient();
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: ChangeRequestInput) => api<{ id: string; video: VideoDetail }>("/change-requests", { body: v }),
    onSuccess: (r) => {
      qc.setQueryData([...keys.videos, "one", r.video.id], r.video);
      return refresh();
    },
  });
}

export function useChangeRequestStatus() {
  const qc = useQueryClient();
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { id: string; status: string }) => api<VideoDetail>(`/change-requests/${v.id}/status`, { body: { status: v.status } }),
    onSuccess: (video) => {
      qc.setQueryData([...keys.videos, "one", video.id], video);
      return refresh();
    },
  });
}

export const useContentList = (query = "", enabled = true) =>
  useQuery({ queryKey: [...keys.content, query], queryFn: () => api<ContentItem[]>(`/content${query ? `?${query}` : ""}`), enabled });

export const useContent = (id: string) => useQuery({ queryKey: [...keys.content, "one", id], queryFn: () => api<ContentItem>(`/content/${id}`) });

export function useContentAction(id: string) {
  const qc = useQueryClient();
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { path: string; method?: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }) =>
      api<(ContentItem & { videoId?: string }) | undefined>(`/content/${id}${v.path}`, {
        method: v.method ?? "POST",
        body: v.method === "DELETE" ? undefined : (v.body ?? {}),
      }),
    onSuccess: (data) => {
      if (data) qc.setQueryData([...keys.content, "one", id], data);
      return refresh();
    },
  });
}

export function useCreateContent() {
  const refresh = useRefreshProduction();
  return useMutation({ mutationFn: (v: ContentInput) => api<ContentItem>("/content", { body: v }), onSuccess: refresh });
}

export type { ContentUpdate, ScriptInput, ClientDecision, VersionInput, VideoUpdate };

export const useTopicLists = (month: string) =>
  useQuery({ queryKey: [...keys.topicLists, month], queryFn: () => api<TopicList[]>(`/topic-lists?month=${month}`) });

export function useTopicListAction() {
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { step: "save"; clientId: string; month: string; needed: number } | { step: "send" | "confirm"; id: string }) =>
      v.step === "save"
        ? api<TopicList[]>("/topic-lists", { method: "PUT", body: { clientId: v.clientId, month: v.month, needed: v.needed } })
        : api<TopicList[]>(`/topic-lists/${v.id}/${v.step}`, { body: {} }),
    onSuccess: refresh,
  });
}

export function useSavePillars(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pillars: string[]) => api<{ pillars: string[] }>(`/clients/${clientId}/pillars`, { method: "PUT", body: { pillars } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clients }),
  });
}

export const useShoots = (query = "") =>
  useQuery({ queryKey: [...keys.shoots, query], queryFn: () => api<ShootSummary[]>(`/shoots${query ? `?${query}` : ""}`) });
export const useShoot = (id: string) => useQuery({ queryKey: [...keys.shoots, "one", id], queryFn: () => api<ShootDetail>(`/shoots/${id}`) });

export function useShootAction(id: string) {
  const qc = useQueryClient();
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { path: string; method?: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }) =>
      api<ShootDetail>(`/shoots/${id}${v.path}`, { method: v.method ?? "POST", body: v.method === "DELETE" ? undefined : (v.body ?? {}) }),
    onSuccess: (data) => {
      qc.setQueryData([...keys.shoots, "one", id], data);
      return refresh();
    },
  });
}

export function useCreateShoot() {
  const refresh = useRefreshProduction();
  return useMutation({ mutationFn: (v: ShootInput) => api<ShootDetail>("/shoots", { body: v }), onSuccess: refresh });
}

export const usePublishingQueue = (month: string, enabled = true) =>
  useQuery({ queryKey: [...keys.publishing, month], queryFn: () => api<PublishingItem[]>(`/publishing?month=${month}`), enabled });
export const useQuotas = (month: string, enabled = true) =>
  useQuery({ queryKey: [...keys.publishing, "quotas", month], queryFn: () => api<QuotaRow[]>(`/publishing/quotas?month=${month}`), enabled });

export function usePublishingAction() {
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (
      v:
        | { step: "schedule"; input: PostInput }
        | { step: "reschedule"; id: string; scheduledAt?: string; caption?: string }
        | { step: "unschedule"; id: string }
        | { step: "published"; id: string; input: PublishedInput }
        | { step: "post-now"; id: string },
    ) => {
      switch (v.step) {
        case "post-now":
          return api<PublishingItem[]>(`/publishing/posts/${v.id}/post-now`, { body: {} });
        case "schedule":
          return api<PublishingItem[]>("/publishing/posts", { body: v.input });
        case "reschedule":
          return api<PublishingItem[]>(`/publishing/posts/${v.id}`, { method: "PATCH", body: { scheduledAt: v.scheduledAt, caption: v.caption } });
        case "unschedule":
          return api<PublishingItem[]>(`/publishing/posts/${v.id}`, { method: "DELETE" });
        case "published":
          return api<PublishingItem[]>(`/publishing/posts/${v.id}/published`, { body: v.input });
      }
    },
    onSuccess: refresh,
  });
}

export const usePlatforms = (clientId: string, enabled = true) =>
  useQuery({ queryKey: ["platforms", clientId], queryFn: () => api<PlatformConnectionRow[]>(`/clients/${clientId}/platforms`), enabled });

export function usePlatformAction(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "add"; platform: string; handle: string }
        | { step: "remove"; id: string }
        | { step: "choose"; id: string; accountId: string }
        | { step: "disconnect"; id: string }
        | { step: "auto"; id: string; autoPublish: boolean },
    ) => {
      const base = `/clients/${clientId}/platforms`;
      switch (v.step) {
        case "add":
          return api<PlatformConnectionRow[]>(base, { body: { platform: v.platform, handle: v.handle } });
        case "remove":
          return api<PlatformConnectionRow[]>(`${base}/${v.id}`, { method: "DELETE" });
        case "choose":
          return api<PlatformConnectionRow[]>(`${base}/${v.id}/choose`, { body: { accountId: v.accountId } });
        case "disconnect":
          return api<PlatformConnectionRow[]>(`${base}/${v.id}/disconnect`, { body: {} });
        case "auto":
          return api<PlatformConnectionRow[]>(`${base}/${v.id}/auto-publish`, { method: "PUT", body: { autoPublish: v.autoPublish } });
      }
    },
    onSuccess: (data) => qc.setQueryData(["platforms", clientId], data),
  });
}

/** Whether connecting Instagram, Facebook, YouTube, LinkedIn and X is switched on here (P3-11, P5-22). */
export const useSocial = () => useQuery({ queryKey: ["social"], queryFn: () => api<SocialSettings>("/social"), staleTime: 5 * 60_000 });

/** The platform's sign-in page for one of a client's platforms. */
export const useConnectPlatform = (clientId: string) =>
  useMutation({ mutationFn: (id: string) => api<{ url: string }>(`/clients/${clientId}/platforms/${id}/connect`, { body: {} }) });

/** The accounts a sign-in reached, to choose the one to post to. */
export const usePlatformAccounts = (clientId: string, id: string | null) =>
  useQuery({
    queryKey: ["platforms", clientId, id, "accounts"],
    queryFn: () => api<SocialAccountChoice[]>(`/clients/${clientId}/platforms/${id}/accounts`),
    enabled: !!id,
  });

export const useCycles = (month: string) => useQuery({ queryKey: [...keys.cycles, month], queryFn: () => api<CycleRow[]>(`/cycles?month=${month}`) });

export function useCycleAction() {
  const refresh = useRefreshProduction();
  return useMutation({
    mutationFn: (v: { step: "generate"; month: string } | { step: "close"; id: string; decision?: "carry" | "credit" | "forfeit"; note?: string }) =>
      v.step === "generate"
        ? api(`/cycles/generate`, { body: { month: v.month } })
        : api(`/cycles/${v.id}/close`, { body: { decision: v.decision, note: v.note } }),
    onSuccess: refresh,
  });
}

// ─── Background jobs ──────────────────────────────────────────────────

export const useJobs = (status: "" | "failed") =>
  useQuery({ queryKey: [...keys.jobs, status], queryFn: () => api<JobRow[]>(`/jobs${status ? `?status=${status}` : ""}`), refetchInterval: 30_000 });

export const useJobOverview = (enabled = true) =>
  useQuery({ queryKey: [...keys.jobs, "overview"], queryFn: () => api<JobOverview>("/jobs/overview"), enabled, refetchInterval: 60_000 });

export function useRetryJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<JobRow>(`/jobs/${id}/retry`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.jobs }),
  });
}

// ─── Genie Assistant ──────────────────────────────────────────────────

export const useGenieSettings = () => useQuery({ queryKey: ["genie", "settings"], queryFn: () => api<GenieSettings>("/genie/settings") });

export function useSaveGenieSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: GenieRulesInput) => api<GenieSettings>("/genie/settings", { method: "PUT", body: v }),
    onSuccess: (data) => qc.setQueryData(["genie", "settings"], data),
  });
}

/** What the rules found that this person may see. */
export const useInsights = (f: { status?: string; rule?: string; mine?: boolean } = {}) => {
  const q = new URLSearchParams({ status: f.status ?? "open", ...(f.rule && { rule: f.rule }), ...(f.mine && { mine: "1" }) });
  return useQuery({ queryKey: ["genie", "insights", q.toString()], queryFn: () => api<InsightRow[]>(`/genie/insights?${q}`) });
};

export function useInsightDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: "done" | "dismissed" | "open" }) =>
      api<InsightRow | null>(`/genie/insights/${v.id}`, { method: "PUT", body: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genie", "insights"] }),
  });
}

export function useSaveAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AiSettingsInput) => api<GenieSettings>("/genie/ai", { method: "PUT", body: v }),
    onSuccess: (data) => qc.setQueryData(["genie", "settings"], data),
  });
}

export const useEvaluate = () => useMutation({ mutationFn: (size: number) => api<GenieEvaluation>("/genie/evaluate", { body: { size } }) });

export const useAiUsage = (enabled = true) => useQuery({ queryKey: ["genie", "usage"], queryFn: () => api<AiUsageSummary>("/genie/usage"), enabled });

export const useCreateDraft = () => useMutation({ mutationFn: (v: DraftRequest) => api<DraftRow>("/genie/drafts", { body: v }) });

export function useDecideDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected"; final?: Record<string, unknown> }) =>
      api<{ draft: DraftRow; whatsappLink?: string; postsUpdated?: number }>(`/genie/drafts/${v.id}/decision`, { body: { status: v.status, final: v.final } }),
    // Approving changes other screens (posts' captions, the idea bank, a report's note).
    onSuccess: () => qc.invalidateQueries(),
  });
}

export const useConversations = () =>
  useQuery({ queryKey: ["genie", "conversations"], queryFn: () => api<{ id: string; title: string; updatedAt: string }[]>("/genie/conversations") });

export const useConversation = (id: string | null) =>
  useQuery({ queryKey: ["genie", "conversations", id], queryFn: () => api<AskConversationRow>(`/genie/conversations/${id}`), enabled: !!id });

export function useAsk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { question: string; conversationId?: string }) => api<AskConversationRow>("/genie/ask", { body: v }),
    onSuccess: (c) => {
      qc.setQueryData(["genie", "conversations", c.id], c);
      void qc.invalidateQueries({ queryKey: ["genie", "conversations"], exact: true });
    },
  });
}

export function useForgetConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/genie/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genie", "conversations"] }),
  });
}

export function useRunGenie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ raised: number; kept: number; resolved: number }>("/genie/run", { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["genie"] }),
  });
}

// ─── Finance and costing ──────────────────────────────────────────────

export const useExpenses = (f: { month: string; status?: string }) => {
  const q = new URLSearchParams({ month: f.month, ...(f.status && { status: f.status }) });
  return useQuery({ queryKey: ["expenses", q.toString()], queryFn: () => api<ExpenseRow[]>(`/expenses?${q}`) });
};

export function useExpenseAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "create"; body: ExpenseInput }
        | { step: "update"; id: string; body: ExpenseInput }
        | { step: "remove"; id: string }
        | { step: "decide"; id: string; approved: boolean; note?: string },
    ) => {
      switch (v.step) {
        case "create":
          return api<ExpenseRow>("/expenses", { body: v.body });
        case "update":
          return api<ExpenseRow>(`/expenses/${v.id}`, { method: "PUT", body: v.body });
        case "remove":
          return api(`/expenses/${v.id}`, { method: "DELETE" });
        case "decide":
          return api<ExpenseRow>(`/expenses/${v.id}/decision`, { body: { approved: v.approved, note: v.note } });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["expenses"] });
      void qc.invalidateQueries({ queryKey: ["vendors"] });
      void qc.invalidateQueries({ queryKey: ["costing"] });
    },
  });
}

export const useFinanceMonths = (enabled = true) =>
  useQuery({ queryKey: ["finance", "months"], queryFn: () => api<FinanceMonthRow[]>("/finance/months"), enabled });

export function useFinanceMonthAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "close"; month: string } | { step: "reopen"; month: string; reason: string }) =>
      v.step === "close"
        ? api<FinanceMonthRow>(`/finance/months/${v.month}/close`, { body: {} })
        : api<FinanceMonthRow>(`/finance/months/${v.month}/reopen`, { body: { reason: v.reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance"] }),
  });
}

export const useAgeing = () => useQuery({ queryKey: ["finance", "ageing"], queryFn: () => api<AgeingReport>("/collections/ageing") });

export const useVendors = () => useQuery({ queryKey: ["vendors"], queryFn: () => api<{ id: string; name: string; category: string | null }[]>("/vendors") });

export const useCostRates = () => useQuery({ queryKey: ["costing", "rates"], queryFn: () => api<CostRateRow[]>("/costing/rates") });

export function useSaveCostRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; body: CostRateInput }) => api<CostRateRow[]>(`/costing/rates/${v.userId}`, { method: "PUT", body: v.body }),
    onSuccess: (data) => {
      qc.setQueryData(["costing", "rates"], data);
      void qc.invalidateQueries({ queryKey: ["costing"] });
    },
  });
}

export const useCostSettings = () => useQuery({ queryKey: ["costing", "settings"], queryFn: () => api<CostSettings>("/costing/settings") });

export function useSaveCostSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: CostSettingsInput) => api<CostSettings>("/costing/settings", { method: "PUT", body: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["costing"] }),
  });
}

export const useCostingSummary = (month: string) =>
  useQuery({ queryKey: ["costing", "summary", month], queryFn: () => api<CostingSummary>(`/costing/summary?month=${month}`) });
export const useClientCosts = (month: string, enabled = true) =>
  useQuery({ queryKey: ["costing", "clients", month], queryFn: () => api<ClientCostRow[]>(`/costing/clients?month=${month}`), enabled });
export const useVideoCosts = (month: string, enabled = true) =>
  useQuery({ queryKey: ["costing", "videos", month], queryFn: () => api<VideoCostRow[]>(`/costing/videos?month=${month}`), enabled });

// ─── People: employees, attendance, leave ─────────────────────────────

export const usePeople = () => useQuery({ queryKey: ["people"], queryFn: () => api<EmployeeRow[]>("/people") });
export const useDepartments = () =>
  useQuery({
    queryKey: ["people", "departments"],
    queryFn: () => api<{ id: string; name: string; headId: string | null; people: number }[]>("/people/departments"),
  });

export function usePeopleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "update"; userId: string; body: EmployeeInput }
        | { step: "bank"; userId: string; body: EmployeeBankInput }
        | { step: "addDepartment"; name: string }
        | { step: "removeDepartment"; id: string },
    ) => {
      switch (v.step) {
        case "update":
          return api(`/people/${v.userId}`, { method: "PUT", body: v.body });
        case "bank":
          return api(`/people/${v.userId}/bank`, { method: "PUT", body: v.body });
        case "addDepartment":
          return api("/people/departments", { body: { name: v.name } });
        case "removeDepartment":
          return api(`/people/departments/${v.id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });
}

export const useAttendance = (month: string) =>
  useQuery({ queryKey: ["attendance", month], queryFn: () => api<AttendanceMonth>(`/attendance?month=${month}`) });
export const useAttendanceSettings = () => useQuery({ queryKey: ["attendance", "settings"], queryFn: () => api<AttendanceSettings>("/attendance/settings") });
export const useCorrections = (state = "") =>
  useQuery({
    queryKey: ["attendance", "corrections", state],
    queryFn: () => api<AttendanceCorrectionRow[]>(`/attendance/corrections${state ? `?state=${state}` : ""}`),
  });

export function useAttendanceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "settings"; body: AttendanceSettings }
        | { step: "correct"; body: AttendanceCorrectionInput }
        | { step: "decide"; id: string; approved: boolean; note?: string },
    ) =>
      v.step === "settings"
        ? api<AttendanceSettings>("/attendance/settings", { method: "PUT", body: v.body })
        : v.step === "correct"
          ? api("/attendance/corrections", { body: v.body })
          : api(`/attendance/corrections/${v.id}/decision`, { body: { approved: v.approved, note: v.note } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export const useLeaveTypes = () => useQuery({ queryKey: ["leave", "types"], queryFn: () => api<LeaveTypeRow[]>("/leave/types") });
export const useLeaveRequests = (status = "") =>
  useQuery({ queryKey: ["leave", "requests", status], queryFn: () => api<LeaveRequestRow[]>(`/leave${status ? `?status=${status}` : ""}`) });
export const useLeaveBalances = (year: number) =>
  useQuery({ queryKey: ["leave", "balances", year], queryFn: () => api<LeaveBalanceRow[]>(`/leave/balances?year=${year}`) });

export function useLeaveAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "request"; body: LeaveRequestInput }
        | { step: "cancel"; id: string }
        | { step: "decide"; id: string; approved: boolean; note?: string }
        | { step: "types"; types: (Omit<LeaveTypeRow, "id"> & { id?: string })[] },
    ) => {
      switch (v.step) {
        case "request":
          return api("/leave", { body: v.body });
        case "cancel":
          return api(`/leave/${v.id}/cancel`, { body: {} });
        case "decide":
          return api(`/leave/${v.id}/decision`, { body: { approved: v.approved, note: v.note } });
        case "types":
          return api("/leave/types", { method: "PUT", body: { types: v.types } });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["leave"] });
      void qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

// ─── Business diagnostic, road map and scenarios ──────────────────────

export const useDiagnostic = () => useQuery({ queryKey: ["diagnostic"], queryFn: () => api<DiagnosticView>("/diagnostic"), retry: false });
export const useDiagnosticClients = () =>
  useQuery({
    queryKey: ["diagnostic", "clients"],
    queryFn: () => api<{ rows: ClientDiagnosticRow[]; medianFee: number; medianHours: number }>("/diagnostic/clients"),
  });
export const useRoadMap = () => useQuery({ queryKey: ["diagnostic", "road-map"], queryFn: () => api<RoadMapRow[]>("/road-map") });
export const useScenarios = () => useQuery({ queryKey: ["diagnostic", "scenarios"], queryFn: () => api<ScenarioRow[]>("/scenarios") });
export const useScenarioBaseline = () => useQuery({ queryKey: ["diagnostic", "baseline"], queryFn: () => api<ScenarioInputs>("/scenarios/baseline") });

export function useDiagnosticAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "take"; body: DiagnosticInput }
        | { step: "fitment"; clientId: string; fitment: FitmentQuadrant | null }
        | { step: "item"; id?: string; body: RoadMapInput }
        | { step: "removeItem"; id: string }
        | { step: "draft" }
        | { step: "scenario"; id?: string; body: ScenarioInput }
        | { step: "removeScenario"; id: string },
    ) => {
      switch (v.step) {
        case "take":
          return api("/diagnostic", { body: v.body });
        case "fitment":
          return api(`/diagnostic/clients/${v.clientId}`, { method: "PUT", body: { fitment: v.fitment } });
        case "item":
          return api(v.id ? `/road-map/${v.id}` : "/road-map", { method: v.id ? "PUT" : "POST", body: v.body });
        case "removeItem":
          return api(`/road-map/${v.id}`, { method: "DELETE" });
        case "draft":
          return api("/road-map/draft", { body: {} });
        case "scenario":
          return api<ScenarioRow[]>(v.id ? `/scenarios/${v.id}` : "/scenarios", { method: v.id ? "PUT" : "POST", body: v.body });
        case "removeScenario":
          return api(`/scenarios/${v.id}`, { method: "DELETE" });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["diagnostic"] });
      void qc.invalidateQueries({ queryKey: keys.clients });
    },
  });
}

// ─── SOPs and checklists ──────────────────────────────────────────────

export const useSops = () => useQuery({ queryKey: ["sops"], queryFn: () => api<SopRow[]>("/sops") });
export const useSop = (id: string | null) => useQuery({ queryKey: ["sops", id], queryFn: () => api<SopRow>(`/sops/${id}`), enabled: !!id });
export const useSopRuns = (filter: { status?: string; mine?: boolean; sopId?: string }) =>
  useQuery({
    queryKey: ["sops", "runs", filter.status ?? "", !!filter.mine, filter.sopId ?? ""],
    queryFn: () =>
      api<SopRunRow[]>(
        filter.sopId
          ? `/sops/${filter.sopId}/runs`
          : `/sops/runs?${new URLSearchParams({ ...(filter.status && { status: filter.status }), ...(filter.mine && { mine: "true" }) })}`,
      ),
  });

export function useSopAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "save"; id?: string; body: SopInput }
        | { step: "newDraft"; id: string }
        | { step: "version"; versionId: string; body: SopVersionInput }
        | { step: "submit"; versionId: string }
        | { step: "decide"; versionId: string; approved: boolean; note: string }
        | { step: "run"; id: string; body: SopRunInput }
        | { step: "check"; runId: string; passed: boolean; note: string },
    ) => {
      switch (v.step) {
        case "save":
          return api<SopRow>(v.id ? `/sops/${v.id}` : "/sops", { method: v.id ? "PUT" : "POST", body: v.body });
        case "newDraft":
          return api(`/sops/${v.id}/versions`, { body: {} });
        case "version":
          return api(`/sops/versions/${v.versionId}`, { method: "PUT", body: v.body });
        case "submit":
          return api(`/sops/versions/${v.versionId}/submit`, { body: {} });
        case "decide":
          return api(`/sops/versions/${v.versionId}/decision`, { body: { approved: v.approved, note: v.note } });
        case "run":
          return api(`/sops/${v.id}/runs`, { body: v.body });
        case "check":
          return api(`/sops/runs/${v.runId}/check`, { body: { passed: v.passed, note: v.note } });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sops"] }),
  });
}

// ─── Round Table ──────────────────────────────────────────────────────

export const useRoundTables = () =>
  useQuery({ queryKey: ["round-tables"], queryFn: () => api<Pick<RtSessionRow, "id" | "name" | "status" | "createdAt" | "releasedAt">[]>("/round-tables") });
/** While it is live, it is read every two seconds so everyone follows the rounds. */
export const useRoundTable = (id: string | null) =>
  useQuery({
    queryKey: ["round-tables", id],
    queryFn: () => api<RtSessionRow>(`/round-tables/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === "live" ? 2000 : false),
  });
export const useRtMine = (id: string | null, enabled: boolean) =>
  useQuery({ queryKey: ["round-tables", id, "mine"], queryFn: () => api<RtFeedback>(`/round-tables/${id}/mine`), enabled: !!id && enabled });

export function useRtAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "create"; body: RtSessionInput }
        | { step: "start" | "next" | "release"; id: string }
        | { step: "answer"; id: string; answers: [string, string, string] }
        | { step: "hide"; answerId: string; hidden: boolean; reason: string }
        | { step: "commit"; id: string; text: string },
    ) => {
      switch (v.step) {
        case "create":
          return api<RtSessionRow>("/round-tables", { body: v.body });
        case "start":
        case "next":
        case "release":
          return api<RtSessionRow>(`/round-tables/${v.id}/${v.step}`, { body: {} });
        case "answer":
          return api<RtSessionRow>(`/round-tables/${v.id}/answer`, { method: "PUT", body: { answers: v.answers } });
        case "hide":
          return api<RtSessionRow>(`/round-tables/answers/${v.answerId}`, { method: "PUT", body: { hidden: v.hidden, reason: v.reason } });
        case "commit":
          return api(`/round-tables/${v.id}/commitment`, { body: { text: v.text } });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["round-tables"] });
      void qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}

// ─── Reviews, decisions and commitments ───────────────────────────────

export const useCadences = (enabled = true) =>
  useQuery({ queryKey: ["reviews", "cadences"], queryFn: () => api<CadenceRow[]>("/reviews/cadences"), enabled, retry: false });
export const useMeetings = () =>
  useQuery({
    queryKey: ["reviews", "meetings"],
    queryFn: () => api<Pick<MeetingRow, "id" | "cadence" | "number" | "title" | "startsAt" | "status">[]>("/reviews/meetings"),
  });
export const useMeeting = (id: string | null) =>
  useQuery({ queryKey: ["reviews", "meeting", id], queryFn: () => api<MeetingRow>(`/reviews/meetings/${id}`), enabled: !!id });
export const useCommitments = (filter: { status?: string; mine?: boolean }) =>
  useQuery({
    queryKey: ["reviews", "commitments", filter.status ?? "", !!filter.mine],
    queryFn: () =>
      api<CommitmentRow[]>(`/commitments?${new URLSearchParams({ ...(filter.status && { status: filter.status }), ...(filter.mine && { mine: "true" }) })}`),
  });
export const useDecisions = () => useQuery({ queryKey: ["reviews", "decisions"], queryFn: () => api<DecisionRow[]>("/decisions") });

export function useReviewAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "cadence"; cadence: ReviewCadence; body: CadenceInput }
        | { step: "schedule"; body: MeetingInput }
        | { step: "update"; id: string; body: MeetingUpdate }
        | { step: "lock"; id: string }
        | { step: "commit"; body: CommitmentInput }
        | { step: "mark"; id: string; mark: "BT" | "BD"; note: string; meetingId?: string; due?: string }
        | { step: "done"; id: string }
        | { step: "decide"; body: DecisionInput },
    ) => {
      switch (v.step) {
        case "cadence":
          return api(`/reviews/cadences/${v.cadence}`, { method: "PUT", body: v.body });
        case "schedule":
          return api<MeetingRow>("/reviews/meetings", { body: v.body });
        case "update":
          return api(`/reviews/meetings/${v.id}`, { method: "PUT", body: v.body });
        case "lock":
          return api(`/reviews/meetings/${v.id}/lock`, { body: {} });
        case "commit":
          return api("/commitments", { body: v.body });
        case "mark":
          return api(`/commitments/${v.id}/mark`, { body: { mark: v.mark, note: v.note, meetingId: v.meetingId, due: v.due } });
        case "done":
          return api(`/commitments/${v.id}/done`, { body: {} });
        case "decide":
          return api("/decisions", { body: v.body });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

// ─── Goals ────────────────────────────────────────────────────────────

export const useGoals = () => useQuery({ queryKey: ["goals"], queryFn: () => api<GoalRow[]>("/goals") });
export const useGoalSettings = () => useQuery({ queryKey: ["goals", "settings"], queryFn: () => api<GoalSettings>("/goals/settings") });
export const useCascade = (enabled = true) =>
  useQuery({ queryKey: ["goals", "cascade"], queryFn: () => api<CascadeView>("/goals/cascade"), enabled, retry: false });

export function useGoalAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "save"; id?: string; body: GoalInput }
        | { step: "remove"; id: string }
        | { step: "checkIn"; id: string; body: CheckInInput }
        | { step: "settings"; body: GoalSettings }
        | { step: "cascade"; body: CascadeInputs }
        | { step: "apply"; links: { goalId: string; figure: string }[] }
        | { step: "fromQuestionnaire" },
    ) => {
      switch (v.step) {
        case "save":
          return api<GoalRow>(v.id ? `/goals/${v.id}` : "/goals", { method: v.id ? "PUT" : "POST", body: v.body });
        case "remove":
          return api(`/goals/${v.id}`, { method: "DELETE" });
        case "checkIn":
          return api(`/goals/${v.id}/check-ins`, { body: v.body });
        case "settings":
          return api("/goals/settings", { method: "PUT", body: v.body });
        case "cascade":
          return api("/goals/cascade", { method: "PUT", body: v.body });
        case "apply":
          return api("/goals/cascade/apply", { body: { links: v.links } });
        case "fromQuestionnaire":
          return api<GoalRow[]>("/goals/from-questionnaire", { method: "POST" });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

// ─── Daily data sheet ─────────────────────────────────────────────────

export type SheetTemplateRow = SheetTemplate & { id: string; people: number };
export const useSheetTemplates = () => useQuery({ queryKey: ["sheets", "templates"], queryFn: () => api<SheetTemplateRow[]>("/daily-sheets/templates") });
export const useSheetSettings = () => useQuery({ queryKey: ["sheets", "settings"], queryFn: () => api<SheetSettings>("/daily-sheets/settings") });
export const useSheetDay = (date: string, person?: string) =>
  useQuery({
    queryKey: ["sheets", "day", date, person ?? ""],
    queryFn: () => api<DailySheetRow>(`/daily-sheets/day/${date}${person ? `?person=${person}` : ""}`),
    retry: false,
  });
export const useSheetTeam = (date: string) =>
  useQuery({ queryKey: ["sheets", "team", date], queryFn: () => api<SheetTeamRow[]>(`/daily-sheets/team?date=${date}`) });

export function useSheetAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "settings"; body: SheetSettings }
        | { step: "template"; id?: string; body: SheetTemplateInput }
        | { step: "removeTemplate"; id: string }
        | { step: "save"; date: string; body: SheetInput }
        | { step: "submit"; date: string }
        | { step: "sign"; id: string }
        | { step: "sendBack"; id: string; note: string },
    ) => {
      switch (v.step) {
        case "settings":
          return api("/daily-sheets/settings", { method: "PUT", body: v.body });
        case "template":
          return api(v.id ? `/daily-sheets/templates/${v.id}` : "/daily-sheets/templates", { method: v.id ? "PUT" : "POST", body: v.body });
        case "removeTemplate":
          return api(`/daily-sheets/templates/${v.id}`, { method: "DELETE" });
        case "save":
          return api<DailySheetRow>(`/daily-sheets/day/${v.date}`, { method: "PUT", body: v.body });
        case "submit":
          return api<DailySheetRow>(`/daily-sheets/day/${v.date}/submit`, { body: {} });
        case "sign":
          return api<DailySheetRow>(`/daily-sheets/${v.id}/sign`, { body: {} });
        case "sendBack":
          return api<DailySheetRow>(`/daily-sheets/${v.id}/send-back`, { body: { note: v.note } });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["sheets"] });
      void qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

// ─── Performance and learning ─────────────────────────────────────────

export const usePerformanceSettings = () =>
  useQuery({ queryKey: ["performance", "settings"], queryFn: () => api<PerformanceSettings>("/performance/settings") });
export const useKraTemplates = () => useQuery({ queryKey: ["performance", "templates"], queryFn: () => api<KraTemplateRow[]>("/performance/templates") });
export const usePerformanceTeam = (month: string) =>
  useQuery({ queryKey: ["performance", "team", month], queryFn: () => api<TeamMemberRow[]>(`/performance/team?month=${month}`) });
export const useScorecard = (id: string | null) =>
  useQuery({ queryKey: ["performance", "scorecard", id], queryFn: () => api<MonthScorecardRow>(`/performance/scorecards/${id}`), enabled: !!id });
export const useMyScorecards = () => useQuery({ queryKey: ["performance", "mine"], queryFn: () => api<MonthScorecardRow[]>("/performance/scorecards/mine") });
export const useLeaderboard = (month: string) =>
  useQuery({ queryKey: ["performance", "leaderboard", month], queryFn: () => api<LeaderboardRow[]>(`/performance/leaderboard?month=${month}`), retry: false });
export const usePlayerRatings = (month: string) =>
  useQuery({ queryKey: ["performance", "ratings", month], queryFn: () => api<PlayerRatingRow[]>(`/performance/ratings?month=${month}`) });

export function usePerformanceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "settings"; body: Partial<PerformanceSettings> }
        | { step: "template"; id?: string; body: KraTemplateInput }
        | { step: "removeTemplate"; id: string }
        | { step: "start"; userId: string; month: string }
        | { step: "update"; id: string; actuals: Record<string, number | null>; note: string }
        | { step: "refresh" | "share" | "reopen"; id: string }
        | { step: "reply"; id: string; text: string }
        | { step: "rate"; userId: string; body: PlayerRatingInput },
    ) => {
      switch (v.step) {
        case "settings":
          return api("/performance/settings", { method: "PUT", body: v.body });
        case "template":
          return api(v.id ? `/performance/templates/${v.id}` : "/performance/templates", { method: v.id ? "PUT" : "POST", body: v.body });
        case "removeTemplate":
          return api(`/performance/templates/${v.id}`, { method: "DELETE" });
        case "start":
          return api<MonthScorecardRow>("/performance/scorecards", { body: { userId: v.userId, month: v.month } });
        case "update":
          return api(`/performance/scorecards/${v.id}`, { method: "PUT", body: { actuals: v.actuals, note: v.note } });
        case "refresh":
        case "share":
        case "reopen":
          return api(`/performance/scorecards/${v.id}/${v.step}`, { body: {} });
        case "reply":
          return api(`/performance/scorecards/${v.id}/reply`, { body: { text: v.text } });
        case "rate":
          return api(`/performance/ratings/${v.userId}`, { method: "PUT", body: v.body });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["performance"] });
      void qc.invalidateQueries({ queryKey: ["people"] });
    },
  });
}

export const useLearningPaths = () => useQuery({ queryKey: ["learning", "paths"], queryFn: () => api<LearningPathRow[]>("/learning/paths") });
export const useLearningAssignments = () =>
  useQuery({ queryKey: ["learning", "assignments"], queryFn: () => api<LearningAssignmentRow[]>("/learning/assignments") });
export const useSkillMatrix = () => useQuery({ queryKey: ["learning", "skills"], queryFn: () => api<SkillMatrix>("/learning/skills") });

export function useLearningAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "path"; id?: string; body: LearningPathInput }
        | { step: "removePath"; id: string }
        | { step: "assign"; id: string; userIds: string[] }
        | { step: "mark"; id: string; key: string; done: boolean }
        | { step: "skills"; skills: { id?: string; name: string; group: string }[] }
        | { step: "level"; skillId: string; userId: string; level: number },
    ) => {
      switch (v.step) {
        case "path":
          return api(v.id ? `/learning/paths/${v.id}` : "/learning/paths", { method: v.id ? "PUT" : "POST", body: v.body });
        case "removePath":
          return api(`/learning/paths/${v.id}`, { method: "DELETE" });
        case "assign":
          return api(`/learning/paths/${v.id}/assign`, { body: { userIds: v.userIds } });
        case "mark":
          return api(`/learning/assignments/${v.id}/modules/${encodeURIComponent(v.key)}`, { method: "PUT", body: { done: v.done } });
        case "skills":
          return api("/learning/skills", { method: "PUT", body: { skills: v.skills } });
        case "level":
          return api(`/learning/skills/${v.skillId}/levels/${v.userId}`, { method: "PUT", body: { level: v.level } });
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["learning"] }),
  });
}

// ─── Hiring ───────────────────────────────────────────────────────────

export const useOpenings = () => useQuery({ queryKey: ["hiring", "openings"], queryFn: () => api<OpeningRow[]>("/hiring/openings") });
export const useCandidates = (openingId?: string) =>
  useQuery({
    queryKey: ["hiring", "candidates", openingId ?? ""],
    queryFn: () => api<CandidateRow[]>(`/hiring/candidates${openingId ? `?openingId=${openingId}` : ""}`),
  });
export const useCandidate = (id: string | null) =>
  useQuery({ queryKey: ["hiring", "candidate", id], queryFn: () => api<CandidateRow>(`/hiring/candidates/${id}`), enabled: !!id });
export const useHiringSettings = () => useQuery({ queryKey: ["hiring", "settings"], queryFn: () => api<HiringSettings>("/hiring/settings") });

export function useHiringAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "settings"; body: Partial<HiringSettings> }
        | { step: "opening"; id?: string; body: OpeningInput }
        | { step: "candidate"; id?: string; body: CandidateInput }
        | { step: "move"; id: string; stage: CandidateStage; reason?: string }
        | { step: "interview"; id: string; body: InterviewInput }
        | { step: "cancelInterview"; interviewId: string }
        | { step: "score"; id: string; body: ScorecardInput }
        | { step: "approve"; id: string; approved: boolean; note?: string }
        | { step: "offer"; id: string; body: OfferInput }
        | { step: "answer"; id: string; accepted: boolean }
        | { step: "join"; id: string },
    ) => {
      switch (v.step) {
        case "settings":
          return api("/hiring/settings", { method: "PUT", body: v.body });
        case "opening":
          return api<OpeningRow>(v.id ? `/hiring/openings/${v.id}` : "/hiring/openings", { method: v.id ? "PUT" : "POST", body: v.body });
        case "candidate":
          return api<CandidateRow>(v.id ? `/hiring/candidates/${v.id}` : "/hiring/candidates", { method: v.id ? "PUT" : "POST", body: v.body });
        case "move":
          return api(`/hiring/candidates/${v.id}/stage`, { method: "PUT", body: { stage: v.stage, reason: v.reason } });
        case "interview":
          return api(`/hiring/candidates/${v.id}/interviews`, { body: v.body });
        case "cancelInterview":
          return api(`/hiring/interviews/${v.interviewId}`, { method: "DELETE" });
        case "score":
          return api(`/hiring/candidates/${v.id}/scorecard`, { method: "PUT", body: v.body });
        case "approve":
          return api(`/hiring/candidates/${v.id}/approval`, { body: { approved: v.approved, note: v.note } });
        case "offer":
          return api(`/hiring/candidates/${v.id}/offer`, { method: "PUT", body: v.body });
        case "answer":
          return api(`/hiring/candidates/${v.id}/offer/answer`, { body: { accepted: v.accepted } });
        case "join":
          return api(`/hiring/candidates/${v.id}/join`, { body: {} });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hiring"] });
      void qc.invalidateQueries({ queryKey: keys.team });
    },
  });
}

// ─── Payroll ──────────────────────────────────────────────────────────

export const usePayrollSettings = () => useQuery({ queryKey: ["payroll", "settings"], queryFn: () => api<PayrollSettings>("/payroll/settings") });
export const useSalaries = () => useQuery({ queryKey: ["payroll", "salaries"], queryFn: () => api<SalaryRow[]>("/payroll/salaries") });
export const usePayrollRuns = () => useQuery({ queryKey: ["payroll", "runs"], queryFn: () => api<PayrollRunRow[]>("/payroll/runs") });
export const usePayrollRun = (month: string | null) =>
  useQuery({ queryKey: ["payroll", "runs", month], queryFn: () => api<PayrollRunRow>(`/payroll/runs/${month}`), enabled: !!month });
export const useMyPayslips = () => useQuery({ queryKey: ["payslips"], queryFn: () => api<PayslipRow[]>("/payslips") });
export const usePayslip = (id: string) => useQuery({ queryKey: ["payslips", id], queryFn: () => api<PayslipRow>(`/payslips/${id}`) });

export function usePayrollAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "settings"; body: PayrollSettingsInput }
        | { step: "salary"; userId: string; body: SalaryInput }
        | { step: "removeSalary"; id: string }
        | { step: "start"; month: string }
        | { step: "refresh" | "lock" | "remove"; month: string }
        | { step: "unlock"; month: string; reason: string }
        | { step: "change"; month: string; userId: string; body: PayslipChange },
    ) => {
      switch (v.step) {
        case "settings":
          return api("/payroll/settings", { method: "PUT", body: v.body });
        case "salary":
          return api(`/payroll/salaries/${v.userId}`, { method: "PUT", body: v.body });
        case "removeSalary":
          return api(`/payroll/salaries/${v.id}`, { method: "DELETE" });
        case "start":
          return api("/payroll/runs", { body: { month: v.month } });
        case "refresh":
        case "lock":
          return api(`/payroll/runs/${v.month}/${v.step}`, { body: {} });
        case "remove":
          return api(`/payroll/runs/${v.month}`, { method: "DELETE" });
        case "unlock":
          return api(`/payroll/runs/${v.month}/unlock`, { body: { reason: v.reason } });
        case "change":
          return api(`/payroll/runs/${v.month}/payslips/${v.userId}`, { method: "PUT", body: v.body });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["payroll"] });
      void qc.invalidateQueries({ queryKey: ["payslips"] });
    },
  });
}

/** The bank's transfer sheet for a locked month. */
export const fetchBankSheet = (month: string) => api<{ fileName: string; csv: string; missing: string[] }>(`/payroll/runs/${month}/bank-sheet`);

// ─── Calendar and time ────────────────────────────────────────────────

export const useCalendar = (from: string, to: string) =>
  useQuery({ queryKey: ["calendar", from, to], queryFn: () => api<CalendarEvent[]>(`/calendar?from=${from}&to=${to}`) });

export const useTimeEntries = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: ["time", from, to], queryFn: () => api<TimeEntryRow[]>(`/time?from=${from}&to=${to}`), enabled });

// ─── Set-up guide ─────────────────────────────────────────────────────

export const useSetup = () => useQuery({ queryKey: ["setup"], queryFn: () => api<SetupStatus>("/agency/setup"), staleTime: 30_000 });

/** The agency's own address for its client links (P6-07); null until one is added. */
export const usePortalDomain = () => useQuery({ queryKey: ["portal-domain"], queryFn: () => api<PortalDomain | null>("/agency/portal-domain") });

export function usePortalDomainAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "set"; domain: string } | { step: "check" } | { step: "remove" }) =>
      v.step === "set"
        ? api<PortalDomain>("/agency/portal-domain", { method: "PUT", body: { domain: v.domain } })
        : v.step === "check"
          ? api<PortalDomain>("/agency/portal-domain/check", { method: "POST" })
          : api<null>("/agency/portal-domain", { method: "DELETE" }),
    onSuccess: (d) => qc.setQueryData(["portal-domain"], d ?? null),
  });
}

// ─── Support inbox (P6-15) ─────────────────────────────────────────────

export const useTickets = () => useQuery({ queryKey: ["tickets"], queryFn: () => api<TicketRow[]>("/support/tickets") });
export const useTicket = (id: string) =>
  useQuery({ queryKey: ["tickets", id], queryFn: () => api<TicketDetail>(`/support/tickets/${id}`), refetchInterval: 60_000 });

export function useTicketAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "create"; body: TicketInput } | { step: "reply"; id: string; body: string } | { step: "close"; id: string }) =>
      v.step === "create"
        ? api<TicketDetail>("/support/tickets", { body: v.body })
        : v.step === "reply"
          ? api<TicketDetail>(`/support/tickets/${v.id}/messages`, { body: { body: v.body } })
          : api<TicketDetail>(`/support/tickets/${v.id}/close`, { method: "POST" }),
    onSuccess: (t) => (qc.setQueryData(["tickets", t.id], t), qc.invalidateQueries({ queryKey: ["tickets"], exact: true })),
  });
}

/** The platform console's support inbox. */
export const usePlatformTickets = () =>
  useQuery({ queryKey: ["platform", "tickets"], queryFn: () => api<TicketRow[]>("/platform/support/tickets"), refetchInterval: 60_000 });
export const usePlatformTicket = (id: string | null) =>
  useQuery({ queryKey: ["platform", "tickets", id], queryFn: () => api<TicketDetail>(`/platform/support/tickets/${id}`), enabled: !!id });

export function usePlatformReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: string; close: boolean }) =>
      api<TicketDetail>(`/platform/support/tickets/${v.id}/messages`, { body: { body: v.body, close: v.close } }),
    onSuccess: (t) => (qc.setQueryData(["platform", "tickets", t.id], t), qc.invalidateQueries({ queryKey: ["platform", "tickets"], exact: true })),
  });
}

/** The set-up wizard (P6-06). */
export const useSetupWizard = () => useQuery({ queryKey: ["setup", "wizard"], queryFn: () => api<SetupWizard>("/agency/setup/wizard") });

/** Sample data to try things with: added, or removed with whatever was made for it since. */
export function useSampleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "add" } | { step: "remove" }): Promise<SampleData | SampleRemoved> =>
      v.step === "add" ? api<SampleData>("/agency/setup/sample", { method: "POST" }) : api<SampleRemoved>("/agency/setup/sample", { method: "DELETE" }),
    // Clients, leads, videos and the set-up guide all change.
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useHideSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hidden: boolean) => api<SetupStatus>("/agency/setup", { method: "PUT", body: { hidden } }),
    onSuccess: (data) => qc.setQueryData(["setup"], data),
  });
}

// ─── Client portal: links and requests ────────────────────────────────

export const usePortalLinks = (clientId: string) =>
  useQuery({ queryKey: ["portal-links", clientId], queryFn: () => api<PortalLinkRow[]>(`/clients/${clientId}/portal-links`) });

export function usePortalLinkAction(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { step: "make" | "remove"; contactId: string }) => {
      const path = `/clients/${clientId}/contacts/${v.contactId}/portal-link`;
      if (v.step === "remove") return { link: "", links: await api<PortalLinkRow[]>(path, { method: "DELETE" }) };
      return api<{ link: string; links: PortalLinkRow[] }>(path, { body: {} });
    },
    onSuccess: (r) => qc.setQueryData(["portal-links", clientId], r.links),
  });
}

export const useClientRequests = (status: "" | "open" | "answered", enabled = true) =>
  useQuery({ queryKey: ["client-requests", status], queryFn: () => api<ClientRequestRow[]>(`/client-requests${status ? `?status=${status}` : ""}`), enabled });

export function useAnswerRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; answer: string }) => api<ClientRequestRow>(`/client-requests/${v.id}/answer`, { body: { answer: v.answer } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-requests"] }),
  });
}

// ─── WhatsApp ─────────────────────────────────────────────────────────

export const useWhatsApp = (enabled = true) => useQuery({ queryKey: ["whatsapp"], queryFn: () => api<WhatsAppSettings>("/whatsapp"), enabled });

export function useWhatsAppAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "connect"; body: unknown }
        | { step: "check" }
        | { step: "disconnect" }
        | { step: "template"; body: unknown }
        | { step: "removeTemplate"; purpose: string },
    ) =>
      v.step === "connect"
        ? api<WhatsAppSettings>("/whatsapp/connection", { method: "PUT", body: v.body })
        : v.step === "check"
          ? api<WhatsAppSettings>("/whatsapp/connection/check", { body: {} })
          : v.step === "disconnect"
            ? api<WhatsAppSettings>("/whatsapp/connection", { method: "DELETE" })
            : v.step === "template"
              ? api<WhatsAppSettings>("/whatsapp/templates", { method: "PUT", body: v.body })
              : api<WhatsAppSettings>(`/whatsapp/templates/${v.purpose}`, { method: "DELETE" }),
    onSuccess: (data) => qc.setQueryData(["whatsapp"], data),
  });
}

export const useWhatsAppTest = () =>
  useMutation({ mutationFn: (phone: string) => api<{ sent: boolean; template: string }>("/whatsapp/test", { body: { phone } }) });

export const useWhatsAppMessages = (clientId?: string, enabled = true) =>
  useQuery({
    queryKey: ["whatsapp-messages", clientId ?? ""],
    queryFn: () => api<WhatsAppMessageRow[]>(`/whatsapp/messages${clientId ? `?clientId=${clientId}` : ""}`),
    enabled,
    refetchInterval: 30_000,
  });

export function useContactWhatsApp(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { contactId: string; optIn: boolean; source?: string }) =>
      api(`/clients/${clientId}/contacts/${v.contactId}/whatsapp`, { method: "PUT", body: { optIn: v.optIn, source: v.source } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-links", clientId] }),
  });
}

// ─── Monthly reports ──────────────────────────────────────────────────

export const useReports = (month: string) => useQuery({ queryKey: ["reports", month], queryFn: () => api<ReportRow[]>(`/reports?month=${month}`) });
export const useReport = (id: string) => useQuery({ queryKey: ["reports", "one", id], queryFn: () => api<MonthlyReport>(`/reports/${id}`) });

export function useMakeReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { clientId: string; month: string }) => api<MonthlyReport>("/reports", { body: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

export function useReportAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "refresh" | "release" } | { step: "note"; note: string | null }) =>
      v.step === "note"
        ? api<MonthlyReport>(`/reports/${id}/note`, { method: "PUT", body: { note: v.note } })
        : api<MonthlyReport>(`/reports/${id}/${v.step}`, { body: {} }),
    onSuccess: (data) => {
      qc.setQueryData(["reports", "one", id], data);
      return qc.invalidateQueries({ queryKey: ["reports"], predicate: (q) => q.queryKey[1] !== "one" });
    },
  });
}

export const usePostMetrics = () =>
  useMutation({
    mutationFn: (v: { postId: string; values: Record<string, number | null> }) =>
      api(`/publishing/posts/${v.postId}/metrics`, { method: "PUT", body: v.values }),
  });

// ─── Payments ─────────────────────────────────────────────────────────

export const usePayments = (enabled = true) => useQuery({ queryKey: ["payments"], queryFn: () => api<PaymentSettings>("/payments"), enabled });

export function usePaymentsAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "connect"; body: unknown } | { step: "check" } | { step: "disconnect" }) =>
      v.step === "connect"
        ? api<PaymentSettings>("/payments/connection", { method: "PUT", body: v.body })
        : v.step === "check"
          ? api<PaymentSettings>("/payments/connection/check", { body: {} })
          : api<PaymentSettings>("/payments/connection", { method: "DELETE" }),
    onSuccess: (data) => qc.setQueryData(["payments"], data),
  });
}

export function useRequestPayLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => api(`/invoices/${invoiceId}/pay-link`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.invoices }),
  });
}

// ─── Financial planner ─────────────────────────────────────────────────

/** The signed-in person's own financial planner; `null` until they first save it. */
export const useMyPlanner = () => useQuery({ queryKey: ["planner"], queryFn: () => api<PlannerData | null>("/planner"), retry: false, staleTime: Infinity });

// ─── Equipment and assets ──────────────────────────────────────────────

export const useAssets = () => useQuery({ queryKey: ["assets"], queryFn: () => api<AssetRow[]>("/assets") });
export const useAsset = (id: string | null) => useQuery({ queryKey: ["assets", "one", id], queryFn: () => api<AssetDetail>(`/assets/${id}`), enabled: !!id });
export const useAssetReservations = () => useQuery({ queryKey: ["assets", "reservations"], queryFn: () => api<AssetReservationRow[]>("/assets/reservations") });
export const useAssetShoots = (enabled = true) => useQuery({ queryKey: ["assets", "shoots"], queryFn: () => api<AssetShootRef[]>("/assets/shoots"), enabled });
export const useAssetPeople = (enabled = true) => useQuery({ queryKey: ["assets", "people"], queryFn: () => api<AssetPerson[]>("/assets/people"), enabled });

export function useAssetAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "save"; id?: string; body: AssetInput }
        | { step: "checkOut"; id: string; body: CheckOutInput }
        | { step: "return"; id: string; body: ReturnInput }
        | { step: "reserve"; id: string; body: ReservationInput }
        | { step: "cancelReservation"; reservationId: string }
        | { step: "problem"; id: string; note: string }
        | { step: "maintenance"; id: string; body: MaintenanceInput }
        | { step: "backInService"; maintenanceId: string; body: BackInServiceInput }
        | { step: "retire"; id: string; note: string },
    ) => {
      switch (v.step) {
        case "save":
          return v.id ? api<AssetDetail>(`/assets/${v.id}`, { method: "PUT", body: v.body }) : api<AssetDetail>("/assets", { body: v.body });
        case "checkOut":
          return api<AssetDetail>(`/assets/${v.id}/check-out`, { body: v.body });
        case "return":
          return api<AssetDetail>(`/assets/${v.id}/return`, { body: v.body });
        case "reserve":
          return api<AssetDetail>(`/assets/${v.id}/reservations`, { body: v.body });
        case "cancelReservation":
          return api<AssetDetail>(`/assets/reservations/${v.reservationId}`, { method: "DELETE" });
        case "problem":
          return api<AssetDetail>(`/assets/${v.id}/problem`, { body: { note: v.note } });
        case "maintenance":
          return api<AssetDetail>(`/assets/${v.id}/maintenance`, { body: v.body });
        case "backInService":
          return api<AssetDetail>(`/assets/maintenance/${v.maintenanceId}/back-in-service`, { body: v.body });
        case "retire":
          return api<AssetDetail>(`/assets/${v.id}/retire`, { body: { note: v.note } });
      }
    },
    onSuccess: (d) => {
      qc.setQueryData(["assets", "one", d.id], d);
      return qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

// ─── Projects and tasks ────────────────────────────────────────────────

export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: () => api<ProjectRow[]>("/projects") });
export const useProject = (id: string | null) =>
  useQuery({ queryKey: ["projects", "one", id], queryFn: () => api<ProjectDetail>(`/projects/${id}`), enabled: !!id, retry: false });
export const useProjectSettings = () => useQuery({ queryKey: ["projects", "settings"], queryFn: () => api<{ templates: ProjectTemplate[] }>("/projects/settings") });
export const useTaskPeople = () => useQuery({ queryKey: ["projects", "people"], queryFn: () => api<{ id: string; name: string | null }[]>("/tasks/people") });
export const useTasks = (scope: "mine" | "all", enabled = true) =>
  useQuery({ queryKey: ["projects", "tasks", scope], queryFn: () => api<TaskRow[]>(`/tasks?scope=${scope}`), enabled });

export function useProjectAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "project"; id?: string; body: ProjectInput }
        | { step: "settings"; body: ProjectSettingsInput }
        | { step: "task"; id?: string; body: TaskInput }
        | { step: "status"; id: string; status: TaskStatus }
        | { step: "removeTask"; id: string }
        | { step: "fromCommitment"; commitmentId: string },
    ): Promise<unknown> => {
      switch (v.step) {
        case "project":
          return v.id ? api<ProjectDetail>(`/projects/${v.id}`, { method: "PUT", body: v.body }) : api<ProjectDetail>("/projects", { body: v.body });
        case "settings":
          return api("/projects/settings", { method: "PUT", body: v.body });
        case "task":
          return v.id ? api<TaskRow>(`/tasks/${v.id}`, { method: "PUT", body: v.body }) : api<TaskRow>("/tasks", { body: v.body });
        case "status":
          return api<TaskRow>(`/tasks/${v.id}/status`, { body: { status: v.status } });
        case "removeTask":
          return api(`/tasks/${v.id}`, { method: "DELETE" });
        case "fromCommitment":
          return api<TaskRow>(`/tasks/from-commitment/${v.commitmentId}`, { method: "POST" });
      }
    },
    onSuccess: (_d, v) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["projects"] }),
        ...(v.step === "fromCommitment" || v.step === "status" ? [qc.invalidateQueries({ queryKey: ["reviews", "commitments"] })] : []),
      ]),
  });
}

// ─── The plan and the platform console (ADR 0011) ─────────────────────

export const usePlan = () => useQuery({ queryKey: ["plan"], queryFn: () => api<PlanPage>("/plan") });

export function usePlanAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { plan: string; currency: PlanCurrency }) => api<ChoosePlanResult>("/plan/choose", { body: v }),
    onSuccess: (page) => {
      qc.setQueryData(["plan"], page);
      // The menu and the banner follow the new plan.
      return qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export const usePlanInvoice = (id: string) => useQuery({ queryKey: ["plan", "invoice", id], queryFn: () => api<PlatformInvoiceRow>(`/plan/invoices/${id}`) });
export const usePlatformInvoices = () => useQuery({ queryKey: ["platform", "invoices"], queryFn: () => api<PlatformInvoiceRow[]>("/platform/invoices") });

export const usePlatformAgencies = (enabled = true) =>
  useQuery({ queryKey: ["platform", "agencies"], queryFn: () => api<PlatformAgencyRow[]>("/platform/agencies"), enabled });
export const usePlatformSettings = (enabled = true) =>
  useQuery({ queryKey: ["platform", "settings"], queryFn: () => api<PlatformSettings>("/platform/settings"), enabled });

export function usePlatformConsoleAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      v:
        | { step: "settings"; body: PlatformSettings }
        | {
            step: "subscription";
            agencyId: string;
            body: { plan: string | null; status: string; trialEndsAt: string | null; currentPeriodEnd: string | null };
          },
    ): Promise<unknown> =>
      v.step === "settings"
        ? api<PlatformSettings>("/platform/settings", { method: "PUT", body: v.body })
        : api<PlatformAgencyRow>(`/platform/agencies/${v.agencyId}/subscription`, { method: "PUT", body: v.body }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["platform"] }), qc.invalidateQueries({ queryKey: ["plan"] })]),
  });
}

// ─── Support access (P6-08) ────────────────────────────────────────────

export const useSupportGrants = () => useQuery({ queryKey: ["support"], queryFn: () => api<SupportGrantRow[]>("/support-access") });

export function useSupportAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "grant"; body: SupportGrantInput } | { step: "revoke"; id: string }) =>
      v.step === "grant"
        ? api<SupportGrantRow[]>("/support-access", { body: v.body })
        : api<SupportGrantRow[]>(`/support-access/${v.id}/revoke`, { method: "POST" }),
    onSuccess: (rows) => qc.setQueryData(["support"], rows),
  });
}

// ─── The agency's own data (P6-10) ─────────────────────────────────────

/** The owner's exports; looked at again every few seconds while one is being made. */
export const useDataExports = (enabled: boolean) =>
  useQuery({
    queryKey: ["data", "exports"],
    queryFn: () => api<DataExportRow[]>("/data/exports"),
    enabled,
    refetchInterval: (q) => (q.state.data?.some((e) => e.status === "queued") ? 4_000 : false),
  });

export function useDataAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { step: "export" } | { step: "delete"; confirm: string } | { step: "keep" }) =>
      v.step === "export"
        ? api<DataExportRow[]>("/data/exports", { method: "POST" })
        : v.step === "delete"
          ? api("/data/deletion", { body: { confirm: v.confirm } })
          : api("/data/deletion", { method: "DELETE" }),
    onSuccess: (rows, v) =>
      v.step === "export"
        ? qc.setQueryData(["data", "exports"], rows)
        : Promise.all([qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: keys.notifications })]),
  });
}

/** The platform's team coming into an agency on its consent, and leaving. */
export function useSupportVisit() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (v: { step: "enter"; agencyId: string } | { step: "leave" }) =>
      v.step === "enter" ? api(`/platform/agencies/${v.agencyId}/support`, { method: "POST" }) : api("/platform/support", { method: "DELETE" }),
    // Everything on screen belongs to another agency now: go to its home (or back to the console), then reload it all.
    onSuccess: (_d, v) => {
      router.push(v.step === "enter" ? "/app" : "/app/platform");
      return qc.resetQueries();
    },
  });
}
