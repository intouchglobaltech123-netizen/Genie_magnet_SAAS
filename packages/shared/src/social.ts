// Social connections (P3-11): a client's Instagram, Facebook Page or YouTube channel, connected through the
// platform's own sign-in, posts at the scheduled time and brings in each post's numbers every day. Other platforms,
// and any platform not connected, are posted by hand as before.
import { z } from "zod";
import type { Platform } from "./enums.js";

/** Platforms that can be connected. */
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "youtube"] as const satisfies readonly Platform[];
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export const isSocialPlatform = (p: string): p is SocialPlatform => (SOCIAL_PLATFORMS as readonly string[]).includes(p);

/** Whose sign-in a platform uses. */
export const SOCIAL_NETWORK: Record<SocialPlatform, "meta" | "google"> = { instagram: "meta", facebook: "meta", youtube: "google" };

/**
 * A client platform: posted by hand, connected, waiting for the account to be chosen after signing in, or its sign-in
 * has expired or failed (then it is posted by hand until connected again).
 */
export const CONNECTION_STATUSES = ["manual", "linked", "choose", "expired", "error"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** A post: waiting for its time, being posted by the app, published, or the app could not post it (post it by hand). */
export const POST_STATUSES = ["scheduled", "publishing", "published", "failed"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const chooseAccountInput = z.object({ accountId: z.string().trim().min(1, "Choose the account").max(100) });
export const autoPublishInput = z.object({ autoPublish: z.boolean() });

/** GET /social: whether connecting is switched on for each platform on this server. */
export interface SocialSettings {
  /** "outbox": pretend platforms (development and tests); nothing is really posted. */
  provider: "live" | "outbox";
  available: Record<SocialPlatform, boolean>;
}

/** GET /clients/:id/platforms/:platformId/accounts: the accounts the sign-in gave access to. */
export interface SocialAccountChoice {
  id: string;
  name: string;
  handle: string | null;
}
