import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import type { createPrisma } from "@gm/db";

/**
 * Test sign-in: pick a person and sign in without a password, so everything can be tested before
 * two-factor and Google sign-in are built (P1-10, last in Phase 1).
 * Added only when TEST_SIGN_IN=true, which env.ts refuses in production. Never turn it on for a
 * server that holds real data: anyone who can reach the server could sign in as anyone.
 */
export function testSignIn(db: ReturnType<typeof createPrisma>) {
  return {
    id: "test-sign-in",
    endpoints: {
      /** GET /api/auth/test-sign-in/people — everyone who can be picked, with their agencies and roles. */
      testSignInPeople: createAuthEndpoint("/test-sign-in/people", { method: "GET" }, async (ctx) => {
        const users = await db.user.findMany({
          select: {
            name: true,
            email: true,
            memberships: { select: { role: true, title: true, agency: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "asc" },
        });
        return ctx.json(
          users.map((u) => ({
            name: u.name,
            email: u.email,
            agencies: u.memberships.map((m) => ({ id: m.agency.id, name: m.agency.name, role: m.role, title: m.title })),
          })),
        );
      }),

      /** POST /api/auth/test-sign-in { email, agencyId? } — signs in and opens the chosen (or first) agency. */
      testSignIn: createAuthEndpoint("/test-sign-in", { method: "POST", body: z.object({ email: z.email(), agencyId: z.uuid().optional() }) }, async (ctx) => {
        const found = await ctx.context.internalAdapter.findUserByEmail(ctx.body.email.toLowerCase());
        if (!found) throw new APIError("NOT_FOUND", { message: "No one with that email. Run npm run db:seed for the sample people." });
        const agencies = await db.membership.findMany({ where: { userId: found.user.id }, select: { agencyId: true }, orderBy: { createdAt: "asc" } });
        const wanted = ctx.body.agencyId;
        if (wanted && !agencies.some((m) => m.agencyId === wanted)) throw new APIError("FORBIDDEN", { message: "This person is not a member of that agency." });
        const activeAgencyId = wanted ?? agencies[0]?.agencyId ?? null;

        const session = await ctx.context.internalAdapter.createSession(found.user.id, false, { activeOrganizationId: activeAgencyId });
        await setSessionCookie(ctx, { session, user: found.user });
        return ctx.json({ user: { id: found.user.id, name: found.user.name, email: found.user.email }, activeAgencyId });
      }),
    },
  } satisfies BetterAuthPlugin;
}
