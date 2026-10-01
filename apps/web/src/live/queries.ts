"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AgencyProfile,
  type AgencyProfileInput,
  allows,
  type AreaKey,
  type AuditPage,
  type Client,
  type ClientInput,
  type CreatedInvitation,
  type ImportKind,
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
  return useMutation({ mutationFn: (v: { id: string; active: boolean }) => api<Package>(`/packages/${v.id}/${v.active ? "restore" : "archive"}`, { body: {} }), onSuccess: refresh });
}

export function useDeletePackage() {
  const refresh = useRefresh(keys.packages);
  return useMutation({ mutationFn: (id: string) => api(`/packages/${id}`, { method: "DELETE" }), onSuccess: refresh });
}

// ─── Imports ──────────────────────────────────────────────────────────

export const useImports = () => useQuery({ queryKey: keys.imports, queryFn: () => api<ImportRecord[]>("/imports") });

export function useImport(kind: ImportKind) {
  const refresh = useRefresh(keys.imports, keys.clients, keys.team);
  return useMutation({
    mutationFn: (v: { fileName: string; rows: unknown[] }) => api<ImportResult>(`/imports/${kind}`, { body: v }),
    onSuccess: refresh,
  });
}

export function useUndoImport() {
  const refresh = useRefresh(keys.imports, keys.clients, keys.team);
  return useMutation({ mutationFn: (id: string) => api<{ removed: number; kept: number }>(`/imports/${id}`, { method: "DELETE" }), onSuccess: refresh });
}
