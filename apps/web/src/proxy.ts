import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/server/access";

/** What an agency's own portal address serves (P6-07): its clients' pages and the API calls they make, nothing else. */
const CLIENT_API = ["/api/portal/", "/api/public/", "/api/files/download/", "/api/files/upload/"];

/**
 * An agency's own address (any host not in APP_HOSTS, when that is set): `/c/<token>` and `/q/<token>` show the
 * client portal and the onboarding questionnaire; everything else there is not found.
 */
function agencyAddress(request: NextRequest) {
  const appHosts = (process.env.APP_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const host = (request.headers.get("host") ?? "").split(":")[0]!.toLowerCase();
  if (!appHosts.length || appHosts.includes(host)) return null;
  const path = request.nextUrl.pathname;
  const page = /^\/(c|q)\/([A-Za-z0-9_-]+)\/?$/.exec(path);
  if (page) return NextResponse.rewrite(new URL(`/app/${page[1]}/${page[2]}`, request.url));
  if (CLIENT_API.some((p) => path.startsWith(p)) || path.startsWith("/_next/")) return NextResponse.next();
  return new NextResponse("Not found", { status: 404 });
}

// Hosted demo gate: when DEMO_PASSCODE is set, every page needs the access
// cookie issued by /api/access. Locally (no passcode) the demo stays open.
export async function proxy(request: NextRequest) {
  const own = agencyAddress(request);
  if (own) return own;

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
