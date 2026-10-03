import type { RequestHandler } from "express";
import type { Env } from "../env.js";

/**
 * Headers on every API answer (P6-14): nothing is sniffed as another type, framed or sent on with a referrer, and
 * answers about an agency's data are not kept by browsers or proxies unless a route says otherwise (file downloads
 * set their own). Over HTTPS, browsers are told to keep to HTTPS.
 */
export function securityHeaders(env: Env): RequestHandler {
  const https = env.WEB_ORIGIN.startsWith("https://");
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    if (https) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  };
}
