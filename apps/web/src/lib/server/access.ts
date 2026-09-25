export const ACCESS_COOKIE = "gm-access";

/** Cookie value derived from the passcode, so the code itself is never stored in the browser. */
export async function accessToken(passcode: string) {
  const data = new TextEncoder().encode(`agency-os:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
