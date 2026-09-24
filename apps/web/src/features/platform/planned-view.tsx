"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleHelp, Link2, MessageSquarePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { plannedModules } from "@/features/platform/planned-content";
import { allNavItems } from "@/lib/nav";

export function PlannedView({ slug }: { slug: string }) {
  const item = allNavItems.find((i) => i.href === `/m/${slug}`);
  const mod = plannedModules[slug];
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState<string[]>([]);

  if (!item || !mod) {
    return (
      <Card className="bg-grid">
        <div className="mx-auto max-w-md px-6 py-20 text-center">
          <h2 className="text-[18px] font-semibold">Module not found</h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">This planned module doesn&apos;t exist. See the full list on the module map.</p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/modules">
              <ArrowLeft /> Module map
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  const Icon = item.icon;
  const { Preview } = mod;

  return (
    <>
      <PageHeader
        depth="planned"
        eyebrow={item.moduleNo ? <span>Module {item.moduleNo}</span> : undefined}
        title={
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon className="size-[18px]" />
            </span>
            {item.title}
          </span>
        }
        description={mod.headline}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/modules">
              <ArrowLeft /> All modules
            </Link>
          </Button>
        }
      />

      <section>
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What it will do</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {mod.capabilities.slice(0, 4).map((c) => {
            const CIcon = c.icon;
            return (
              <Card key={c.title} className="p-5">
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted text-foreground">
                  <CIcon className="size-4" />
                </span>
                <div className="mt-3 text-[14px] font-semibold tracking-tight">{c.title}</div>
                <p className="mt-1 text-[13px] text-muted-foreground">{c.desc}</p>
              </Card>
            );
          })}
        </div>
        {mod.capabilities.length > 4 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {mod.capabilities.slice(4).map((c) => {
              const CIcon = c.icon;
              return (
                <Card key={c.title} className="flex items-start gap-3 p-4 xl:col-span-2">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CIcon className="size-4" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold tracking-tight">{c.title}</div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{c.desc}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <CardHeader>
            <div>
              <CardTitle>{mod.previewTitle}</CardTitle>
              <CardDescription>{mod.previewDesc}</CardDescription>
            </div>
            <Badge tone="info">Illustrative preview</Badge>
          </CardHeader>
          <CardContent>
            <Preview />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="size-4 text-muted-foreground" /> Dependencies
                </CardTitle>
                <CardDescription>Needs to be in place first</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                {mod.dependencies.map((d) => (
                  <li key={d} className="flex gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                    {d}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CircleHelp className="size-4 text-muted-foreground" /> Open questions
                </CardTitle>
                <CardDescription>For Janarthanan to confirm</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5 text-[13px]">
                {mod.questions.map((q, i) => (
                  <li key={q} className="flex gap-2.5">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-gold-soft text-[11px] font-semibold text-gold tabular">{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ol>
              <div className="mt-4 border-t border-border pt-4">
                {notes.map((n, i) => (
                  <div key={i} className="mb-2 rounded-lg bg-accent-soft/60 px-3 py-2 text-[12.5px]">
                    {n}
                  </div>
                ))}
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an answer or a requirement…" className="min-h-16 text-[13px]" />
                <Button
                  size="sm"
                  variant="soft"
                  className="mt-2 w-full"
                  onClick={() => {
                    if (!note.trim()) {
                      toast("Type a note first");
                      return;
                    }
                    setNotes((n) => [...n, note.trim()]);
                    setNote("");
                    toast.success("Added to the Phase 2 brief", { description: item.title });
                  }}
                >
                  {note.trim() ? <Send /> : <MessageSquarePlus />} Add to brief
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
