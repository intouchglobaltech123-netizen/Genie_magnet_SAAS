"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Lock, PhoneCall, SearchX, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { BrandMark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { QuestionnaireForm } from "./questionnaire-form";
import { respondentById, respondentByToken } from "./seed";
import { useRespondent } from "./store";

function NotFound({ href, label }: { href: string; label: string }) {
  return (
    <Card className="p-5">
      <EmptyState
        icon={SearchX}
        title="Questionnaire not found"
        description="The link may be wrong or the questionnaire was withdrawn."
        action={
          <Button asChild variant="secondary">
            <Link href={href}>
              <ArrowLeft /> {label}
            </Link>
          </Button>
        }
      />
    </Card>
  );
}

/** The account manager fills the client questionnaire with the client on a call. */
export function AssistedFill({ id }: { id: string }) {
  const seed = respondentById(id);
  const live = useRespondent(id);
  if (!seed || !live) return <NotFound href="/onboarding" label="Onboarding" />;
  if (seed.template === "agency") return <AgencyFill />;
  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/onboarding" className="inline-flex items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            <ArrowLeft className="size-3.5" /> Onboarding
          </Link>
        }
        title={`${seed.name} · onboarding questionnaire`}
        description={`${seed.contact} · ${seed.packageName}. Required sections first; the rest can be finished later by ${seed.contact.split(" ")[0]} from the WhatsApp link.`}
      />
      <Alert tone="info" icon={PhoneCall} title="Assisted mode — filling with the client on a call" className="mb-6">
        Answers are saved as you type and marked “entered by Ashwin”. The client sees the same answers on their own link.
      </Alert>
      <QuestionnaireForm respondentId={id} mode="assisted" />
    </div>
  );
}

export function AgencyFill() {
  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/onboarding" className="inline-flex items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            <ArrowLeft className="size-3.5" /> Onboarding
          </Link>
        }
        title="Agency questionnaire · Genie Magnet"
        description="The four required sections set up the workspace: packages, team roles and the revenue goal. The deeper diagnostic feeds the Client Fitment Map, BFA scorecard and Strategic Road Map."
      />
      <QuestionnaireForm respondentId="agency" mode="agency" />
    </div>
  );
}

/** The client's own link, opened from WhatsApp — no sign-in, no app chrome. */
export function PublicQuestionnaire({ token }: { token: string }) {
  const seed = respondentByToken(token);
  const live = useRespondent(seed?.id ?? "");
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="h-0.5 bg-accent" aria-hidden />
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between gap-3 px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark />
            <span className="truncate text-body font-semibold tracking-tight text-primary dark:text-text-primary">Genie Magnet</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
            <ShieldCheck className="size-4 text-success" /> Private link
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-6 lg:px-8 lg:py-8">
        {!seed || !live || seed.template !== "client" ? (
          <NotFound href="/" label="Home" />
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-heading font-semibold tracking-tight">Welcome, {seed.contact.split(" ")[0]}</h1>
              <p className="mt-1.5 max-w-2xl text-body text-muted-foreground">
                A few questions so Genie Magnet can plan content that works for {seed.name}. Your answers are saved as you type — you can close this page and continue any time.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-body">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
                  <Lock className="size-3.5 text-danger" /> Required: about 8 minutes
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1">
                  <Clock className="size-3.5 text-info" /> The rest within {live.windowDays} days{live.win.dueOn ? ` · by ${live.win.dueOn}` : ""}
                </span>
              </div>
            </div>
            <QuestionnaireForm respondentId={seed.id} mode="public" />
          </>
        )}
      </main>
    </div>
  );
}
