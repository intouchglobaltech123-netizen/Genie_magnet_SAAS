import type { ApiErrorBody } from "@gm/shared";

/** True when this site is connected to the API (API_URL at build time, or local development). */
export const LIVE = process.env.NEXT_PUBLIC_LIVE_APP === "on";

/** An error answer from the API, in its one error shape (`{ message, issues?, requestId? }`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }

  /** The message for one form field, from the API's validation issues. */
  issue(path: string) {
    return this.body.issues?.find((i) => i.path === path)?.message;
  }
}

/**
 * Calls the API through this site (`/api/...`, rewritten to the API in next.config.ts), so the sign-in
 * cookie is first-party. Sign-in routes are `/auth/...`.
 */
export async function api<T>(path: string, init: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (hasBody ? "POST" : "GET"),
      credentials: "same-origin",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, { message: "Cannot reach the server. Check your connection and try again." });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: the API is down behind the web server, or something in between failed.
  }
  if (!res.ok) {
    const body = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, {
      message: body.message ?? (res.status >= 500 ? "The server is not answering right now. Try again in a moment." : `Request failed (${res.status}).`),
      issues: body.issues,
      requestId: body.requestId,
    });
  }
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
