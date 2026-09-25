import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/server/access";

// Hosted demo gate: when DEMO_PASSCODE is set, every page needs the access
// cookie issued by /api/access. Locally (no passcode) the demo stays open.
export async function proxy(request: NextRequest) {
  const passcode = process.env.DEMO_PASSCODE;
  if (!passcode) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  if (cookie && cookie === (await accessToken(passcode))) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Access code required." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/access|api/health|_next/static|_next/image|favicon.ico).*)"],
};
