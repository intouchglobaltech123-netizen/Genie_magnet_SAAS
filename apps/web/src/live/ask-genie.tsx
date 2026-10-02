"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { MessageSquarePlus, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AskConversationRow } from "@gm/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { useAsk, useConversation, useConversations, useForgetConversation } from "./queries";

const LINK = /\[([^\]]+)\]\((\/app\/[^)\s]+)\)/g;
const EXAMPLES = [
  "Which Kaveri videos are waiting on the client?",
  "Which videos are past their due date?",
  "Any overdue invoices?",
  "What needs a look today?",
];

/** An answer's text with its links to records made clickable, and its lists kept as lists. */
function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split("\n").map((line, i) => {
        const bullet = /^\s*[-•*]\s+/.test(line);
        const body = line.replace(/^\s*[-•*]\s+/, "");
        const parts: React.ReactNode[] = [];
        let last = 0;
        for (const m of body.matchAll(LINK)) {
          parts.push(body.slice(last, m.index));
          parts.push(
            <Link key={m.index} href={m[2]!} className="font-medium text-primary hover:underline">
              {m[1]}
            </Link>,
          );
          last = m.index! + m[0].length;
        }
        parts.push(body.slice(last));
        return (
          <p key={i} className={cn(bullet && "pl-4 -indent-3 before:mr-1.5 before:content-['•']")}>
            {parts.map((p, j) => (
              <Fragment key={j}>{p}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Thread({ c }: { c: AskConversationRow }) {
  return (
    <ul className="space-y-3">
      {c.messages.map((m) => (
        <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[85%] rounded-xl px-4 py-2.5 text-body",
              m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card",
            )}
          >
            {m.role === "assistant" ? <Rich text={m.content} /> : m.content}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ask Genie (P4-08): questions about the agency, answered from what this person may see. */
export function AskGenie() {
  const list = useConversations();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = useConversation(openId);
  const ask = useAsk();
  const forget = useForgetConversation();
  const [question, setQuestion] = useState("");

  const send = (q = question) => {
    if (!q.trim()) return;
    ask.mutate(
      { question: q.trim(), conversationId: openId ?? undefined },
      {
        onSuccess: (c) => {
          setOpenId(c.id);
          setQuestion("");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        <Button variant="secondary" className="w-full" onClick={() => (setOpenId(null), setQuestion(""))}>
          <MessageSquarePlus />
          New question
        </Button>
        {list.data && list.data.length > 0 && (
          <ul className="space-y-1">
            {list.data.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-lg px-2.5 py-1.5 text-left text-body hover:bg-muted",
                    c.id === openId && "bg-muted font-medium",
                  )}
                >
                  {c.title}
                </button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100"
                  aria-label="Forget this conversation"
                  onClick={() => forget.mutate(c.id, { onSuccess: () => openId === c.id && setOpenId(null) })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Card className="flex min-h-[420px] flex-col p-4">
        <div className="flex-1">
          {openId && open.isPending ? (
            <SkeletonRows rows={3} />
          ) : openId && open.data ? (
            <Thread c={open.data} />
          ) : (
            <EmptyState
              icon={Sparkles}
              title="Ask about your agency"
              description="Genie Assistant looks it up in your own data — only what you may see — and links to the records."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((e) => (
                    <Button key={e} size="sm" variant="secondary" disabled={ask.isPending} onClick={() => send(e)}>
                      {e}
                    </Button>
                  ))}
                </div>
              }
            />
          )}
          {ask.isPending && <p className="mt-3 text-body text-muted-foreground">Genie Assistant is looking it up…</p>}
          {ask.error && (
            <Alert tone="warning" className="mt-3">
              {errorMessage(ask.error)}
            </Alert>
          )}
        </div>
        <form
          className="mt-4 flex gap-2 border-t border-border-subtle pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Textarea
            rows={2}
            placeholder={openId ? "Ask a follow-up…" : "e.g. Which videos are waiting on the client?"}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button type="submit" disabled={ask.isPending || !question.trim()} aria-label="Ask">
            <Send />
          </Button>
        </form>
      </Card>
    </div>
  );
}
