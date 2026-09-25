import { cookies } from "next/headers";
import { ACCESS_COOKIE, accessToken } from "@/lib/server/access";

export const dynamic = "force-dynamic";

/** Sign in to the hosted demo. With no DEMO_PASSCODE set (local runs) any code is accepted. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const passcode = process.env.DEMO_PASSCODE;
  if (passcode && body?.code !== passcode) {
    return Response.json({ error: "That access code is not correct." }, { status: 401 });
  }
  if (passcode) {
    (await cookies()).set(ACCESS_COOKIE, await accessToken(passcode), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(ACCESS_COOKIE);
  return Response.json({ ok: true });
}
