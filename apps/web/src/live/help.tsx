"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, LifeBuoy, MessageSquare, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { HELP, type HelpArticle } from "./help-articles";

const text = (a: HelpArticle) =>
  [a.title, a.summary, ...a.sections.flatMap((s) => [s.heading ?? "", s.text ?? "", ...(s.steps ?? []), ...(s.notes ?? [])])].join(" ").toLowerCase();

/** The help centre (P6-15): every guide, searchable, and a way to write to support. */
export function LiveHelp() {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return HELP.filter((a) => words.every((w) => text(a).includes(w)));
  }, [q]);
  return (
    <>
      <PageHeader title="Help and support" description="Short guides to each part of the app. If something is not answered here, write to our support team." />
      <div className="relative mb-5 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the guides, e.g. invoice, payroll, portal"
          className="pl-9"
          aria-label="Search the guides"
        />
      </div>
      {shown.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((a) => (
            <li key={a.slug}>
              <Link href={`/app/help/${a.slug}`} className="block h-full">
                <Card className="h-full p-4 transition-colors hover:border-secondary/40">
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="text-body font-medium">{a.title}</div>
                      <p className="mt-1 text-body text-muted-foreground">{a.summary}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="p-6">
          <EmptyState icon={Search} title="No guide matches" description="Try other words, or write to support below." />
        </Card>
      )}
      <SectionCard
        title="Write to support"
        description="Our support team answers in the app, and you are told when they do. Say what you were doing and what you saw; a request id from an error helps."
        className="mt-6"
        actions={
          <Button asChild variant="accent" size="sm">
            <Link href="/app/support">
              <MessageSquare /> Your messages
            </Link>
          </Button>
        }
      >
        <p className="text-body text-muted-foreground">
          If support needs to look inside your workspace, you choose whether to let them in, for how long and how far, in{" "}
          <Link href="/app/settings/support" className="text-primary hover:underline">
            Settings → Support access
          </Link>
          .
        </p>
      </SectionCard>
    </>
  );
}

/** One guide. */
export function LiveHelpArticle({ slug }: { slug: string }) {
  const a = HELP.find((x) => x.slug === slug);
  const back = (
    <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
      <Link href="/app/help">
        <ArrowLeft /> Help
      </Link>
    </Button>
  );
  if (!a)
    return (
      <>
        {back}
        <Alert tone="warning">There is no guide here. It may have moved: look for it in Help.</Alert>
      </>
    );
  return (
    <>
      {back}
      <PageHeader title={a.title} description={a.summary} />
      <Card className="max-w-3xl space-y-6 p-6">
        {a.sections.map((s, i) => (
          <section key={i} className="space-y-2 text-body">
            {s.heading && <h2 className="text-subheading font-semibold">{s.heading}</h2>}
            {s.text && <p className="leading-relaxed">{s.text}</p>}
            {s.steps && (
              <ol className="list-decimal space-y-1.5 pl-5 leading-relaxed">
                {s.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            )}
            {s.notes && (
              <ul className="list-disc space-y-1 pl-5 leading-relaxed text-muted-foreground">
                {s.notes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </Card>
      <div className="mt-6 flex max-w-3xl flex-wrap items-center justify-between gap-3 text-body text-muted-foreground">
        <span>Still stuck?</span>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/support?about=${a.slug}`}>
            <LifeBuoy /> Write to support
          </Link>
        </Button>
      </div>
    </>
  );
}
