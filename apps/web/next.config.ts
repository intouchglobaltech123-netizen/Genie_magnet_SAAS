import type { NextConfig } from "next";

// The real app (/app) talks to the API through this site, so sign-in cookies stay first-party:
// /api/auth/* → the API's Better Auth routes, /api/* → the API itself. The demo's own /api routes
// (access, feedback, health) are files here and win over these rewrites.
// Without API_URL (the hosted demo) there is no API: /app says so and the demo works as before.
const api = process.env.API_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:4000" : undefined);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_LIVE_APP: api ? "on" : "off" },
  async rewrites() {
    if (!api) return [];
    return [
      { source: "/api/auth/:path*", destination: `${api}/api/auth/:path*` },
      { source: "/api/:path*", destination: `${api}/:path*` },
    ];
  },
};

export default nextConfig;
