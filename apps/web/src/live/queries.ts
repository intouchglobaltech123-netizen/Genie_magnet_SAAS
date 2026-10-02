"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AgencyProfile,
  type AgencyProfileInput,
  type Agreement,
  type AgreementEnding,
  type AgreementInput,
  type AgreementRenewal,
  type AgreementUpdate,
  type ClientDetail,
  type AnswerValue,
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

/** `can("clients", "edit")` — the same rule the API enforces, used to hide what the person cannot do. */
export function useCan() {
  const me = useMe().data;
  return (area: AreaKey, level: Exclude<PermissionLevel, "none">) => !!me?.permissions && allows(me.permissions, area, level);
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

export function useImport(kind: ImportKind) {
  const refresh = useRefresh(keys.imports, keys.clients, keys.team, keys.leads);
  return useMutation({
    mutationFn: (v: { fileName: string; rows: unknown[] }) => api<ImportResult>(`/imports/${kind}`, { body: v }),
    onSuccess: refresh,
  });
}

export function useUndoImport() {
  const refresh = useRefresh(keys.imports, keys.clients, keys.team, keys.leads);
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
