import { describe, expect, it } from "vitest";
import { DEFAULT_ROLES } from "./enums.js";
import { allows, DEFAULT_PERMISSIONS, DEFAULT_ROLE_DEFINITIONS, exceeds, FULL_ACCESS, PERMISSION_AREAS, permissionMatrix, scopeOf } from "./permissions.js";

describe("permission checks", () => {
  it("treats each level as including the ones below it", () => {
    const m = { clients: { level: "edit" as const } };
    expect(allows(m, "clients", "view")).toBe(true);
    expect(allows(m, "clients", "edit")).toBe(true);
    expect(allows(m, "clients", "approve")).toBe(false);
    expect(allows(m, "invoices", "view")).toBe(false);
  });

  it("knows whether a role sees all records or only its own", () => {
    expect(scopeOf(DEFAULT_PERMISSIONS.editor, "production")).toBe("own");
    expect(scopeOf(DEFAULT_PERMISSIONS.manager, "production")).toBe("all");
    expect(scopeOf(DEFAULT_PERMISSIONS.editor, "invoices")).toBeNull();
  });

  it("spots a role given more than its giver has", () => {
    expect(exceeds(DEFAULT_PERMISSIONS.editor, DEFAULT_PERMISSIONS.manager)).toEqual([]);
    expect(exceeds({ salaries: { level: "view" } }, DEFAULT_PERMISSIONS.manager)).toEqual(["salaries"]);
    // "own" cannot be widened to "all" by someone who only has "own".
    expect(exceeds({ production: { level: "edit" } }, DEFAULT_PERMISSIONS.editor)).toEqual(["production"]);
    expect(exceeds(DEFAULT_PERMISSIONS.manager, FULL_ACCESS)).toEqual([]);
  });
});

describe("default roles", () => {
  it("cover every default role, and keep salaries and personal finance for the owner", () => {
    expect(DEFAULT_ROLE_DEFINITIONS.map((r) => r.key)).toEqual([...DEFAULT_ROLES]);
    for (const role of DEFAULT_ROLES.filter((r) => r !== "owner")) {
      expect(DEFAULT_PERMISSIONS[role].salaries, role).toBeUndefined();
      expect(DEFAULT_PERMISSIONS[role].personal_finance, role).toBeUndefined();
    }
  });

  it("are valid matrices", () => {
    for (const role of DEFAULT_ROLE_DEFINITIONS) expect(permissionMatrix.safeParse(role.permissions).success, role.key).toBe(true);
  });

  it("keep client people in the portal only", () => {
    expect(Object.keys(DEFAULT_PERMISSIONS.client_approver)).toEqual(["portal"]);
    expect(Object.keys(DEFAULT_PERMISSIONS.client_viewer)).toEqual(["portal"]);
  });
});

describe("permissionMatrix (what Settings may save)", () => {
  it("drops areas set to none and rejects levels or scopes an area does not have", () => {
    expect(permissionMatrix.parse({ clients: { level: "view" }, invoices: { level: "none" } })).toEqual({ clients: { level: "view" } });
    expect(permissionMatrix.safeParse({ audit: { level: "edit" } }).success).toBe(false);
    expect(permissionMatrix.safeParse({ invoices: { level: "view", scope: "own" } }).success).toBe(false);
    expect(permissionMatrix.safeParse({ payroll: { level: "view" } }).success).toBe(false);
  });

  it("lists every area once", () => {
    expect(new Set(PERMISSION_AREAS.map((a) => a.key)).size).toBe(PERMISSION_AREAS.length);
  });
});
