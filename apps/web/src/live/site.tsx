import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { DEFAULT_PLATFORM_SETTINGS, type PlanLimits, type PublicSite, publicSite, SUITES } from "@gm/shared";
import { BrandMark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// The marketing site and pricing page (P6-12): server-rendered from the platform settings, so the brand name, the
// plans and their prices change from the platform console without a release.

const API = process.env.API_URL ?? (process.env.NODE_ENV !== "production" ? "http://localhost:4000" : undefined);

/** The platform settings' public part, at most five minutes old; the defaults when the API cannot be reached. */
export async function loadSite(): Promise<PublicSite> {
  if (API)
    try {
      const res = await fetch(`${API}/public/site`, { next: { revalidate: 300 } });
      if (res.ok) return (await res.json()) as PublicSite;
    } catch {
      // No API at build time, or it is down: show the defaults rather than nothing.
    }
  return publicSite(DEFAULT_PLATFORM_SETTINGS);
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const n = (v: number) => v.toLocaleString("en-IN");
const limit = (k: keyof PlanLimits, v: number | null) => {
  if (k === "users") return v === null ? "As many people on the team as you need" : `${n(v)} people on the team`;
  if (k === "clients") return v === null ? "As many clients as you need" : `${n(v)} clients`;
  if (k === "aiDrafts")
    return v === null ? "Genie Assistant drafts without a limit" : v === 0 ? "No Genie Assistant drafts" : `${n(v)} Genie Assistant drafts a month`;
  return v === null ? "Storage without a limit" : `${n(v)} GB of storage`;
};

const CORE = [
  "Sales pipeline, proposals and agreements",
  "Client onboarding questionnaires",
  "Topics, scripts, shoots, editing and quality checks",
  "A client portal for approvals, with your branding",
  "Publishing to Instagram, YouTube, LinkedIn and X",
  "GST invoices, payment links and reminders",
  "WhatsApp messages from your own number",
];

export function SiteHeader({ site }: { site: PublicSite }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/welcome" className="flex min-w-0 items-center gap-3">
          <BrandMark />
          <span className="truncate text-subheading font-semibold text-primary">{site.brandName}</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="accent" size="sm">
            <Link href="/app/sign-up">Start free</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter({ site }: { site: PublicSite }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-body text-muted-foreground sm:px-6">
        <span>
          © {new Date().getFullYear()} {site.brandName}
        </span>
        <Link href="/pricing" className="hover:text-primary">
          Pricing
        </Link>
        <Link href="/app/sign-in" className="hover:text-primary">
          Sign in
        </Link>
      </div>
    </footer>
  );
}

export function Plans({ site }: { site: PublicSite }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {site.plans.map((p) => (
        <Card key={p.key} className="flex flex-col p-5">
          <h3 className="text-subheading font-semibold">{p.name}</h3>
          <p className="mt-1 min-h-10 text-body text-muted-foreground">{p.description}</p>
          <div className="mt-4">
            {p.priceInr !== null ? (
              <>
                <span className="text-heading font-semibold">{inr(p.priceInr)}</span>
                <span className="text-body text-muted-foreground"> a month + GST</span>
              </>
            ) : (
              <span className="text-subheading font-semibold">Price on request</span>
            )}
            {p.priceUsd !== null && <div className="text-body text-muted-foreground">or US${p.priceUsd.toLocaleString("en-US")} a month outside India</div>}
          </div>
          <ul className="mt-4 space-y-1.5 text-body">
            {(Object.keys(p.limits) as (keyof PlanLimits)[]).map((k) => (
              <li key={k} className="text-muted-foreground">
                {limit(k, p.limits[k])}
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex-1 space-y-1.5 border-t border-border-subtle pt-4 text-body">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> Everything in the core
            </li>
            {SUITES.map((s) => {
              const has = p.suites.includes(s.key);
              return (
                <li key={s.key} className={has ? "flex gap-2" : "flex gap-2 text-text-muted"}>
                  {has ? <Check className="mt-0.5 size-4 shrink-0 text-success" /> : <Minus className="mt-0.5 size-4 shrink-0" />} {s.label}
                </li>
              );
            })}
          </ul>
          <Button asChild variant={site.trialPlan === p.name ? "accent" : "outline"} className="mt-5">
            <Link href="/app/sign-up">{site.trialDays ? `Try it free for ${site.trialDays} days` : "Start"}</Link>
          </Button>
        </Card>
      ))}
    </div>
  );
}

export function PricingPage({ site }: { site: PublicSite }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader site={site} />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-heading font-semibold">Pricing</h1>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">
          Every plan has the whole core of {site.brandName}; the larger plans add suites and room.
          {site.trialDays > 0 && ` Start with ${site.trialDays} days free${site.trialPlan ? ` on ${site.trialPlan}` : ""}, no card needed.`} Change plans at any
          time from your workspace.
        </p>
        <div className="mt-8">
          <Plans site={site} />
        </div>
        <Core />
      </main>
      <SiteFooter site={site} />
    </div>
  );
}

function Core() {
  return (
    <section className="mt-12 grid gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <h2 className="text-subheading font-semibold">In every plan: the core</h2>
        <ul className="mt-3 space-y-2 text-body">
          {CORE.map((c) => (
            <li key={c} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-success" /> {c}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-6">
        <h2 className="text-subheading font-semibold">The suites</h2>
        <dl className="mt-3 space-y-3 text-body">
          {SUITES.map((s) => (
            <div key={s.key}>
              <dt className="font-medium">{s.label}</dt>
              <dd className="text-muted-foreground">{s.description}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

export function LandingPage({ site }: { site: PublicSite }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader site={site} />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="text-body font-medium text-accent-strong">For content and video agencies</p>
          {/* eslint-disable-next-line no-restricted-syntax -- the public website's headline is larger than the app's sizes */}
          <h1 className="mt-3 max-w-3xl text-[2.25rem] font-semibold leading-tight tracking-tight text-primary sm:text-[3rem]">
            Run your agency from the first call to the last invoice.
          </h1>
          <p className="mt-5 max-w-2xl text-subheading text-text-secondary">
            {site.brandName} brings sales, client onboarding, production, approvals, publishing, invoices, your team and your goals into one place — so nothing
            lives in scattered sheets and chats, and every client sees their work in a portal with your name on it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/app/sign-up">{site.trialDays ? `Start your ${site.trialDays}-day free trial` : "Get started"}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </section>
        <section className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
            {[
              [
                "Win and onboard clients",
                "A pipeline that follows up for you, proposals within your discount rules, agreements, and an onboarding questionnaire clients fill in by link.",
              ],
              [
                "Deliver every month",
                "Topics, scripts, shoots and editing on one board, quality checks before anything goes out, approvals in the client portal, and scheduled posts.",
              ],
              [
                "Know where you stand",
                "GST invoices with payment links, the true cost of each video and client, payroll, goals with a revenue cascade, and reviews that keep the team on them.",
              ],
            ].map(([title, body]) => (
              <div key={title}>
                <h2 className="text-subheading font-semibold">{title}</h2>
                <p className="mt-2 text-body text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-heading font-semibold">Plans</h2>
          <p className="mt-2 text-body text-muted-foreground">Start with the core and add suites as the agency grows.</p>
          <div className="mt-6">
            <Plans site={site} />
          </div>
        </section>
      </main>
      <SiteFooter site={site} />
    </div>
  );
}
