import type { NextConfig } from "next";

// The real app (/app) talks to the API through this site, so sign-in cookies stay first-party:
// /api/auth/* → the API's Better Auth routes, /api/* → the API itself. The demo's own /api routes
// (access, feedback, health) are files here and win over these rewrites.
// Without API_URL (the hosted demo) there is no API: /app says so and the demo works as before.
const api = process.env.API_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:4000" : undefined);

// Security headers on every page (P6-14). Pages opened by a private link (the client portal, questionnaires) carry the
// token in their address, so they send no referrer at all; elsewhere only the origin leaves the site.
const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];
const tokenPages = ["/app/c/:token*", "/app/q/:token*", "/c/:token*", "/q/:token*"];

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_LIVE_APP: api ? "on" : "off" },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: [...common, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      ...tokenPages.map((source) => ({ source, headers: [{ key: "Referrer-Policy", value: "no-referrer" }] })),
    ];
  },
  async rewrites() {
    if (!api) return [];
    return [
      { source: "/api/auth/:path*", destination: `${api}/api/auth/:path*` },
      { source: "/api/:path*", destination: `${api}/:path*` },
    ];
  },
};

export default nextConfig;
