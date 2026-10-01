import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { organization } from "better-auth/plugins";
import type { createPrisma } from "@gm/db";
import type { AuditWriter } from "../audit/audit.service.js";
import type { Env } from "../env.js";
import { currentActorId } from "./mount.js";
import type { Outbox } from "./outbox.js";
import { testSignIn } from "./test-sign-in.js";

export const AUTH = Symbol("AUTH");
export const AUTH_PRISMA = Symbol("AUTH_PRISMA");

/**
 * The agency routes Better Auth keeps. People and roles are managed by the API (/team, /roles), which checks the
 * agency's permission matrix and audits each change; Better Auth's own invite/role/remove/list routes are closed,
 * so its fixed roles can never bypass the matrix (ADR 0003, ADR 0004).
 */
const AGENCY_ROUTES_KEPT = new Set([
  "/organization/create",
  "/organization/check-slug",
  "/organization/list",
  "/organization/set-active",
  "/organization/get-active-member",
  "/organization/get-invitation",
  "/organization/list-user-invitations",
  "/organization/accept-invitation",
  "/organization/reject-invitation",
]);

export interface AuthDeps {
  outbox: Outbox;
  audit: AuditWriter;
  /** Gives a new agency its default roles (P1-11). */
  setUpAgency: (agencyId: string) => Promise<void>;
}

/**
 * Sign-in for Genie Magnet OS (ADR 0003): accounts, sessions, creating and switching agencies, and accepting
 * invitations. An agency is a Better Auth organization; the session's active organization is the agency every
 * API request works in. Runs on the genie_auth database role.
 */
export function createAuth(env: Env, prisma: ReturnType<typeof createPrisma>, { outbox, audit, setUpAgency }: AuthDeps) {
  const log = new Logger("Auth");
  /** Agency changes made here are audited right after they happen; a failed entry is logged, never hidden. */
  const record = async (agencyId: string, fallbackActor: string | undefined, entry: Parameters<AuditWriter>[2]) => {
    try {
      await audit(agencyId, currentActorId() ?? fallbackActor, entry);
    } catch (e) {
      log.error(`Audit entry not written: ${entry.action} ${entry.entity} ${entry.entityId ?? ""}`, { agencyId, error: String(e) });
    }
  };

  return betterAuth({
    appName: "Genie Magnet OS",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    advanced: { database: { generateId: () => randomUUID() } },
    // Per IP: 100 requests a minute, and Better Auth's stricter rules for sign-in and sign-up (3 per 10 s)
    // and password-reset and verification emails (3 a minute). In memory, like the API's own limit.
    rateLimit: { enabled: true, window: 60, max: 100, storage: "memory" },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path.startsWith("/organization/") && !AGENCY_ROUTES_KEPT.has(ctx.path)) {
          throw new APIError("NOT_FOUND", { message: "People and roles are managed in Settings (API: /team and /roles)." });
        }
      }),
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) => outbox.send({ to: user.email, subject: "Reset your Genie Magnet OS password", text: url, link: url }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => outbox.send({ to: user.email, subject: "Confirm your email for Genie Magnet OS", text: url, link: url }),
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : undefined,
    plugins: [
      organization({
        creatorRole: "owner",
        // Only a confirmed email address can accept an invitation, so an invitation cannot be claimed by guessing its id.
        requireEmailVerificationOnInvitation: true,
        schema: {
          organization: { modelName: "agency" },
          member: { modelName: "membership", fields: { organizationId: "agencyId" } },
          invitation: { modelName: "invitation", fields: { organizationId: "agencyId" } },
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization, user }) => {
            await setUpAgency(organization.id);
            await record(organization.id, user.id, {
              action: "create",
              entity: "agency",
              entityId: organization.id,
              after: { name: organization.name, slug: organization.slug },
            });
          },
          // The creator joining as owner (other people join by accepting an invitation).
          afterAddMember: ({ member, user, organization }) =>
            record(organization.id, user.id, {
              action: "create",
              entity: "membership",
              entityId: member.id,
              after: { userId: user.id, name: user.name, role: member.role },
            }),
          afterAcceptInvitation: ({ invitation, member, user, organization }) =>
            record(organization.id, user.id, {
              action: "accept",
              entity: "invitation",
              entityId: invitation.id,
              after: { membershipId: member.id, name: user.name, role: member.role },
            }),
          afterRejectInvitation: ({ invitation, user, organization }) =>
            record(organization.id, user.id, { action: "reject", entity: "invitation", entityId: invitation.id, after: { email: invitation.email } }),
        },
      }),
      // Password-free sign-in for testing; never on in production (env.ts).
      ...(env.TEST_SIGN_IN ? [testSignIn(prisma)] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
