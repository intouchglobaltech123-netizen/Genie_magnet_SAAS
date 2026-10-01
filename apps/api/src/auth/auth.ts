import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, memberAc, ownerAc } from "better-auth/plugins/organization/access";
import type { createPrisma } from "@gm/db";
import { DEFAULT_ROLES } from "@gm/shared";
import type { Env } from "../env.js";
import type { Outbox } from "./outbox.js";
import { testSignIn } from "./test-sign-in.js";

export const AUTH = Symbol("AUTH");
export const AUTH_PRISMA = Symbol("AUTH_PRISMA");

/**
 * Better Auth's own checks (who may invite or remove people) use its three presets. What each role may do
 * in the product is decided by the agency's permission matrix (CASL, P1-11), not here.
 */
const ac = createAccessControl(defaultStatements);
const presets = { owner: ac.newRole(ownerAc.statements), manager: ac.newRole(adminAc.statements), member: ac.newRole(memberAc.statements) };
const betterAuthRoles = Object.fromEntries(
  DEFAULT_ROLES.map((r) => [r, r === "owner" ? presets.owner : r === "manager" ? presets.manager : presets.member]),
) as Record<(typeof DEFAULT_ROLES)[number], typeof presets.member>;

/**
 * Sign-in for Genie Magnet OS (ADR 0003). An agency is a Better Auth organization; the session's active
 * organization is the agency every API request works in. Runs on the genie_auth database role.
 */
export function createAuth(env: Env, prisma: ReturnType<typeof createPrisma>, outbox: Outbox) {
  return betterAuth({
    appName: "Genie Magnet OS",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    advanced: { database: { generateId: () => randomUUID() } },
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
        ac,
        roles: betterAuthRoles,
        creatorRole: "owner",
        // Only a confirmed email address can accept an invitation, so an invitation cannot be claimed by guessing its id.
        requireEmailVerificationOnInvitation: true,
        invitationExpiresIn: 7 * 24 * 60 * 60,
        schema: {
          organization: { modelName: "agency" },
          member: { modelName: "membership", fields: { organizationId: "agencyId" } },
          invitation: { modelName: "invitation", fields: { organizationId: "agencyId" } },
        },
        sendInvitationEmail: async (data) => {
          const link = `${env.WEB_ORIGIN}/invite/${data.id}`;
          await outbox.send({
            to: data.email,
            subject: `${data.inviter.user.name} invited you to ${data.organization.name} on Genie Magnet OS`,
            text: link,
            link,
          });
        },
      }),
      // Password-free sign-in for testing; never on in production (env.ts).
      ...(env.TEST_SIGN_IN ? [testSignIn(prisma)] : []),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
