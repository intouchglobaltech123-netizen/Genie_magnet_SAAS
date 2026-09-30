"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useContent } from "@/features/content/store";
import { askGenie, SUGGESTED, type GenieAnswer } from "./ask";

interface Turn {
  id: number;
  q: string;
  a?: GenieAnswer;
}

/** Ask Genie: read-only questions over the agency's data, answered with sources. */
export function AskPanel({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const videos = useDemo((s) => s.videos);
  const content = useContent((s) => s.items);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const thinking = turns.some((t) => !t.a);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    const id = ++idRef.current;
    setTurns((t) => [...t, { id, q: text }]);
    setQ("");
    window.setTimeout(() => {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, a: askGenie(text, { videos, content }) } : x)));
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }, 650);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" aria-live="polite">
        {!turns.length && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <GenieAvatar />
              <div className="rounded-2xl rounded-tl-none bg-surface-secondary px-3.5 py-2.5 text-body">
                Ask me about clients, deadlines, approvals or money. I answer from your data and show where every number comes from.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-10">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="cursor-pointer rounded-full border border-border-strong bg-surface px-3 py-1.5 text-left text-body text-text-secondary transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-none bg-primary px-3.5 py-2 text-body text-primary-foreground">{t.q}</div>
            </div>
            <div className="flex items-start gap-2.5">
              <GenieAvatar />
              {t.a ? (
                <div className="min-w-0 flex-1 space-y-2 rounded-2xl rounded-tl-none bg-surface-secondary px-3.5 py-2.5 text-body">
                  <p className="font-semibold text-text-primary">{t.a.summary}</p>
                  {t.a.lines.length > 0 && (
                    <ul className="space-y-1 text-text-secondary">
                      {t.a.lines.map((l) => (
                        <li key={l} className="flex items-start gap-1.5">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" /> {l}
                        </li>
                      ))}
                    </ul>
                  )}
                  {t.a.next && <p className="text-text-secondary">{t.a.next}</p>}
                  {t.a.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {t.a.sources.map((s) => (
                        <Link
                          key={s.href}
                          href={s.href}
                          onClick={onNavigate}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-body text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                        >
                          {s.label} <ArrowUpRight className="size-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl rounded-tl-none bg-surface-secondary px-3.5 py-3" role="status" aria-label="Genie is thinking">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {turns.length > 0 && !thinking && (
          <div className="flex flex-wrap gap-2 pl-10">
            {SUGGESTED.filter((s) => !turns.some((t) => t.q === s))
              .slice(0, 3)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="cursor-pointer rounded-full border border-border-strong bg-surface px-3 py-1 text-left text-body text-muted-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                >
                  {s}
                </button>
              ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Genie…" aria-label="Ask Genie a question" />
        <Button type="submit" size="icon" disabled={!q.trim() || thinking} aria-label="Send question">
          <ArrowUp />
        </Button>
      </form>
      <p className="mt-2 flex items-center gap-1.5 text-body text-muted-foreground">
        <Lock className="size-3.5" /> Read-only · answers only from data your role can see
      </p>
    </div>
  );
}

export function GenieAvatar() {
  return (
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-active text-accent ring-1 ring-accent/40" aria-hidden>
      <Sparkles className="size-4" />
    </span>
  );
}
