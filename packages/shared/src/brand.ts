// White-label (P6-07): the agency's brand colour turned into the app's colours — buttons, links, focus rings, the
// sidebar and charts — in light and dark mode, kept readable whatever colour the agency picked.
import { z } from "zod";

type Rgb = [number, number, number];

const toRgb = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
};
const toHex = (c: Rgb) =>
  `#${c
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
/** `a` moved toward `b` by `t` (0 = a, 1 = b). */
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as Rgb;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** Relative luminance (WCAG 2). */
export function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours (WCAG 2): 1 to 21. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour, darkened just enough for light text on it to read (4.5 to 1). */
function readableUnder(c: Rgb, text: string) {
  let out = c;
  for (let i = 0; i < 40 && contrast(toHex(out), text) < 4.5; i++) out = mix(out, BLACK, 0.06);
  return out;
}

/** CSS variables for the app in the agency's colour: the light set and the dark set. */
export function brandPalette(hex: string): { light: Record<string, string>; dark: Record<string, string> } {
  const brand = toRgb(hex);
  const primary = readableUnder(brand, "#f8f5f0");
  const secondary = readableUnder(mix(primary, WHITE, 0.22), "#ffffff");
  let sidebar = mix(primary, BLACK, 0.35);
  for (let i = 0; i < 40 && luminance(toHex(sidebar)) > 0.04; i++) sidebar = mix(sidebar, BLACK, 0.08);
  const darkPrimary = readableUnder(mix(primary, WHITE, 0.25), "#ffffff");
  return {
    light: {
      "--color-primary": toHex(primary),
      "--color-primary-hover": toHex(mix(primary, WHITE, 0.12)),
      "--color-primary-active": toHex(mix(primary, BLACK, 0.25)),
      "--color-primary-soft": toHex(mix(primary, WHITE, 0.9)),
      "--color-secondary": toHex(secondary),
      "--color-secondary-hover": toHex(mix(secondary, BLACK, 0.12)),
      "--color-secondary-soft": toHex(mix(primary, WHITE, 0.88)),
      "--color-ring": toHex(primary),
      "--color-sidebar": toHex(sidebar),
      "--color-sidebar-hover": toHex(mix(sidebar, WHITE, 0.07)),
      "--color-sidebar-active": toHex(mix(sidebar, WHITE, 0.18)),
      "--color-sidebar-border": toHex(mix(sidebar, WHITE, 0.1)),
      "--color-chart-1": toHex(primary),
      "--color-chart-2": toHex(secondary),
    },
    dark: {
      "--color-primary": toHex(darkPrimary),
      "--color-primary-hover": toHex(mix(darkPrimary, WHITE, 0.1)),
      "--color-primary-active": toHex(mix(darkPrimary, BLACK, 0.15)),
      "--color-primary-soft": toHex(mix(primary, toRgb("#0a1024"), 0.8)),
      "--color-secondary-soft": toHex(mix(primary, toRgb("#0a1024"), 0.78)),
      "--color-ring": toHex(mix(primary, WHITE, 0.45)),
      "--color-sidebar": toHex(mix(sidebar, BLACK, 0.5)),
    },
  };
}

const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** PUT /agency/portal-domain: the agency's own address for its client links, e.g. portal.youragency.com. */
export const portalDomainInput = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => v.replace(/^https?:\/\//, "").replace(/[/:].*$/, ""))
    .pipe(
      z
        .string()
        .regex(HOST, "Enter an address like portal.youragency.com")
        .refine((v) => v.split(".").length >= 3, "Use a sub-domain, like portal.youragency.com"),
    ),
});

/** GET /agency/portal-domain: the address, whether it is verified, and the DNS records to add. */
export interface PortalDomain {
  domain: string;
  verifiedAt: string | null;
  records: { type: "CNAME" | "TXT"; name: string; value: string }[];
  /** After a check: whether the address points at the platform yet (needed before its certificate); null before. */
  pointed: boolean | null;
}

/** The active agency's brand, on GET /me: its colour in the app when it chose so. */
export interface Branding {
  name: string;
  logo: string | null;
  color: string | null;
  inApp: boolean;
}
