"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { BrandMark, BrandWordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/input";

// Demo sign-in screen: there is no real authentication in the frontend demo,
// so "Sign in" simply opens the workspace.
export default function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("jana@geniemagnet.in");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [codeError, setCodeError] = useState("");

  return (
    <div className="grid grid-cols-1 min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-10" />
          <BrandWordmark inverted sub="Genie Magnet · Internal operating system" />
        </div>

        <div className="max-w-md space-y-5">
          <div className="h-px w-16 bg-accent" />
          <h1 className="text-heading font-semibold text-white">Every promise, every video, every rupee — in one place.</h1>
          <p className="text-body text-sidebar-foreground">
            Plan client delivery, run production and quality gates, track true cost and lead the 45-day review cycle from a single, calm workspace.
          </p>
        </div>

        <div className="flex items-center gap-2 text-body text-sidebar-muted">
          <ShieldCheck className="size-4 text-accent" /> Role-based access · audit trail on every change
        </div>

        {/* Quiet structural lines — no glow, no gradients */}
        <svg className="pointer-events-none absolute -right-24 -top-24 size-[520px] opacity-[0.07]" viewBox="0 0 400 400" fill="none" aria-hidden>
          {[60, 110, 160, 210].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} stroke="white" strokeWidth="1" />
          ))}
        </svg>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark />
            <BrandWordmark />
          </div>
          <h2 className="text-heading font-semibold text-primary dark:text-text-primary">Sign in</h2>
          <p className="mt-1 text-body text-muted-foreground">Welcome back. Use your work account to continue.</p>

          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.includes("@")) {
                setError("Enter a valid work email address.");
                return;
              }
              setError("");
              setCodeError("");
              setBusy(true);
              // The hosted demo is protected by a shared access code (DEMO_PASSCODE); locally any code works.
              const res = await fetch("/api/access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
              }).catch(() => null);
              if (!res?.ok) {
                setBusy(false);
                setCodeError(res?.status === 401 ? "That access code is not correct." : "Could not sign in. Please try again.");
                return;
              }
              const next = new URLSearchParams(window.location.search).get("next");
              router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
            }}
          >
            <Field label="Work email" required error={error}>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error} autoComplete="username" />
            </Field>
            <Field label="Access code" required error={codeError} hint="Use the demo access code shared with you.">
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-invalid={!!codeError}
                  aria-label="Access code"
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide access code" : "Show access code"}
                  className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-muted hover:text-primary"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-body text-text-secondary">
                <Checkbox defaultChecked /> Keep me signed in
              </label>
              <button type="button" className="cursor-pointer text-body font-medium text-primary hover:underline dark:text-text-primary">
                Forgot password?
              </button>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-body text-muted-foreground">
            Are you a client?{" "}
            <Link href="/portal" className="font-medium text-primary hover:underline dark:text-text-primary">
              Open the Client Hub
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
