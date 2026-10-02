"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, LogIn, MailCheck } from "lucide-react";
import { DEFAULT_ROLE_LABELS, type DefaultRole, type TestPerson } from "@gm/shared";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { BrandMark } from "@/components/shell/brand";
import { api, ApiError, errorMessage } from "./api";
import { useAcceptInvitation, useCreateAgency, useMe, useSignIn, useSignUp, useTestPeople, useTestSignIn } from "./queries";

export const roleLabel = (key: string) => DEFAULT_ROLE_LABELS[key as DefaultRole] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function AuthFrame({ title, description, children, wide }: { title: string; description?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-10 sm:py-16">
      <div className={wide ? "w-full max-w-3xl" : "w-full max-w-md"}>
        <div className="mb-6 flex items-center gap-3">
          <BrandMark />
          <span className="text-subheading font-semibold text-primary">Genie Magnet OS</span>
        </div>
        <h1 className="text-heading font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-body text-muted-foreground">{description}</p>}
        <div className="mt-6 space-y-6">{children}</div>
      </div>
    </div>
  );
}

/** Only same-site paths, so a link cannot send people elsewhere after signing in. */
function useNext(fallback = "/app") {
  const next = useSearchParams().get("next");
  return next && next.startsWith("/app") ? next : fallback;
}

function slugFor(name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agency";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Sign in ──────────────────────────────────────────────────────────

function TestPeoplePicker({ people, next }: { people: TestPerson[]; next: string }) {
  const router = useRouter();
  const signIn = useTestSignIn();
  const [busy, setBusy] = useState<string | null>(null);
  const agencies = new Map<string, { name: string; people: { person: TestPerson; role: string; title: string | null }[] }>();
  for (const person of people)
    for (const a of person.agencies) {
      const entry = agencies.get(a.id) ?? { name: a.name, people: [] };
      entry.people.push({ person, role: a.role, title: a.title });
      agencies.set(a.id, entry);
    }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-info" />
          <div>
            <div className="text-body font-semibold">Test sign-in — pick a person</div>
            <p className="text-body text-muted-foreground">
              Only on test servers, with sample data. No password needed. Each person sees what their role allows.
            </p>
          </div>
        </div>
        {[...agencies.entries()].map(([agencyId, a]) => (
          <div key={agencyId}>
            <div className="mb-2 text-body font-medium text-text-secondary">{a.name}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {a.people.map(({ person, role, title }) => (
                <button
                  key={person.email}
                  disabled={!!busy}
                  onClick={() => {
                    setBusy(`${agencyId}:${person.email}`);
                    signIn.mutate({ email: person.email, agencyId }, { onSuccess: () => router.replace(next), onError: () => setBusy(null) });
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-secondary/40 hover:bg-secondary-soft disabled:cursor-wait disabled:opacity-60"
                >
                  <Avatar name={person.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium">{person.name}</span>
                    <span className="block truncate text-body text-muted-foreground">{title ?? person.email}</span>
                  </span>
                  <Badge tone={role === "owner" ? "accent" : "neutral"}>{busy === `${agencyId}:${person.email}` ? "Signing in…" : roleLabel(role)}</Badge>
                </button>
              ))}
            </div>
          </div>
        ))}
        {signIn.error && <Alert tone="danger">{errorMessage(signIn.error)}</Alert>}
      </CardContent>
    </Card>
  );
}

export function SignInPage() {
  const router = useRouter();
  const next = useNext();
  const people = useTestPeople();
  const signIn = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <AuthFrame title="Sign in" description="Your agency's workspace." wide={!!people.data?.length}>
      {people.isPending ? <Skeleton className="h-40 w-full" /> : people.data?.length ? <TestPeoplePicker people={people.data} next={next} /> : null}

      <Card className="max-w-md">
        <CardContent className="p-5">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn.mutate({ email, password }, { onSuccess: () => router.replace(next) });
            }}
          >
            <Field label="Email">
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {signIn.error && <Alert tone="danger">{errorMessage(signIn.error)}</Alert>}
            <Button type="submit" className="w-full" disabled={signIn.isPending}>
              <LogIn />
              {signIn.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-body text-muted-foreground">
            New here?{" "}
            <Link href={`/app/sign-up${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

// ─── Sign up (a new agency, or joining one by invitation) ─────────────

export function SignUpPage() {
  const router = useRouter();
  const next = useNext();
  const joining = next.startsWith("/app/invite/");
  const signUp = useSignUp();
  const createAgency = useCreateAgency();
  const [form, setForm] = useState({ name: "", email: "", password: "", agency: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const error = signUp.error ?? createAgency.error;
  const busy = signUp.isPending || createAgency.isPending;

  return (
    <AuthFrame
      title={joining ? "Create your account" : "Start your agency's workspace"}
      description={joining ? "Use the email address the invitation was sent to." : "You will be its owner. Your team joins by invitation."}
    >
      <Card>
        <CardContent className="p-5">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await signUp.mutateAsync({ name: form.name, email: form.email, password: form.password });
                if (!joining) await createAgency.mutateAsync({ name: form.agency, slug: slugFor(form.agency) });
                router.replace(next);
              } catch {
                // shown below
              }
            }}
          >
            <Field label="Your name" required>
              <Input autoComplete="name" required minLength={2} value={form.name} onChange={set("name")} />
            </Field>
            <Field label="Email" required>
              <Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Password" hint="At least 10 characters." required>
              <Input type="password" autoComplete="new-password" required minLength={10} value={form.password} onChange={set("password")} />
            </Field>
            {!joining && (
              <Field label="Agency name" required>
                <Input required minLength={2} value={form.agency} onChange={set("agency")} />
              </Field>
            )}
            {error && <Alert tone="danger">{errorMessage(error)}</Alert>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Creating…" : joining ? "Create account" : "Create account and agency"}
            </Button>
          </form>
          <p className="mt-4 text-body text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/app/sign-in${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

// ─── A signed-in person without an agency, or adding another one ──────

export function NewAgencyPage() {
  const router = useRouter();
  const me = useMe();
  const createAgency = useCreateAgency();
  const [name, setName] = useState("");

  if (me.data === null) {
    router.replace("/app/sign-in?next=/app/new-agency");
    return null;
  }
  return (
    <AuthFrame title="Create an agency" description="You will be its owner, with the default roles ready to change.">
      <Card>
        <CardContent className="p-5">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              createAgency.mutate({ name, slug: slugFor(name) }, { onSuccess: () => router.replace("/app/setup") });
            }}
          >
            <Field label="Agency name" required>
              <Input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {createAgency.error && <Alert tone="danger">{errorMessage(createAgency.error)}</Alert>}
            <Button type="submit" className="w-full" disabled={createAgency.isPending}>
              {createAgency.isPending ? "Creating…" : "Create agency"}
            </Button>
          </form>
          {!!me.data?.agencies.length && (
            <Link href="/app" className="mt-4 block text-body text-primary hover:underline">
              Back to my workspace
            </Link>
          )}
        </CardContent>
      </Card>
    </AuthFrame>
  );
}

// ─── Accepting an invitation ──────────────────────────────────────────

interface InvitationDetails {
  organizationName: string;
  inviterEmail: string;
  email: string;
  role: string;
  status: string;
}

export function InvitePage({ id }: { id: string }) {
  const router = useRouter();
  const me = useMe();
  const accept = useAcceptInvitation();
  const invitation = useQuery({
    queryKey: ["invitation", id],
    queryFn: () => api<InvitationDetails>(`/auth/organization/get-invitation?id=${encodeURIComponent(id)}`),
    enabled: !!me.data,
    retry: false,
  });
  const here = `/app/invite/${id}`;

  if (me.isPending) return <AuthFrame title="Invitation">{<Skeleton className="h-32 w-full" />}</AuthFrame>;

  if (!me.data) {
    return (
      <AuthFrame title="You have been invited" description="Sign in or create your account with the email address the invitation was sent to.">
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/app/sign-up?next=${encodeURIComponent(here)}`}>Create my account</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/app/sign-in?next=${encodeURIComponent(here)}`}>I already have an account</Link>
          </Button>
        </div>
      </AuthFrame>
    );
  }

  const notFound = invitation.error instanceof ApiError && invitation.error.status < 500;
  return (
    <AuthFrame title="Join an agency">
      {invitation.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : notFound || !invitation.data ? (
        <Alert tone="warning" title="This invitation cannot be used">
          It may have expired, been cancelled, or been sent to a different email address than {me.data.user.email}. Ask the person who invited you to send a new
          one.
        </Alert>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-body">
                <span className="font-semibold">{invitation.data.inviterEmail}</span> invited you to join{" "}
                <span className="font-semibold">{invitation.data.organizationName}</span> as <Badge tone="accent">{roleLabel(invitation.data.role)}</Badge>
              </p>
            </div>
            {accept.error && <Alert tone="danger">{errorMessage(accept.error)}</Alert>}
            <Button onClick={() => accept.mutate(id, { onSuccess: () => router.replace("/app") })} disabled={accept.isPending}>
              {accept.isPending ? "Joining…" : `Join ${invitation.data.organizationName}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </AuthFrame>
  );
}
