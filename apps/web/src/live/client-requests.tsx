"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, Send } from "lucide-react";
import { toast } from "sonner";
import { CLIENT_REQUEST_KINDS, type ClientRequestKind, type ClientRequestRow } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "./api";
import { fmtDate } from "./format";
import { useAnswerRequest, useCan, useClientRequests } from "./queries";

function RequestCard({ r, canAnswer }: { r: ClientRequestRow; canAnswer: boolean }) {
  const answer = useAnswerRequest();
  const [text, setText] = useState("");
  return (
    <Card>
      <CardContent className="space-y-2 p-4 text-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <Link href={`/app/clients/${r.client.id}`} className="font-medium hover:underline">
              {r.client.name}
            </Link>
            <span className="text-muted-foreground">
              {" "}
              · {r.contactName} · {fmtDate(r.createdAt)}
            </span>
          </span>
          <Badge tone="outline">{CLIENT_REQUEST_KINDS[r.kind as ClientRequestKind] ?? r.kind}</Badge>
        </div>
        <p className="whitespace-pre-line">{r.text}</p>
        {r.answer ? (
          <p className="whitespace-pre-line rounded-lg bg-primary-soft/50 px-3 py-2">
            {r.answer}
            <span className="text-muted-foreground">
              {" "}
              — {r.answeredBy?.name ?? "the team"}
              {r.answeredAt && `, ${fmtDate(r.answeredAt)}`}
            </span>
          </p>
        ) : canAnswer ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Your answer — the client sees it in their portal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label="Answer"
            />
            <Button
              size="sm"
              disabled={!text.trim() || answer.isPending}
              onClick={() =>
                answer.mutate({ id: r.id, answer: text.trim() }, { onSuccess: () => toast.success("Answered"), onError: (e) => toast.error(errorMessage(e)) })
              }
            >
              <Send />
              Answer
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** What clients ask from their portals (P3-05), with the team's answers. */
export function LiveClientRequests() {
  const can = useCan();
  const [status, setStatus] = useState<"open" | "answered">("open");
  const list = useClientRequests(status);
  return (
    <>
      <PageHeader title="Client requests" description="Ideas, changes and questions clients send from their portal. Your answer shows in their portal." />
      <Tabs value={status} onValueChange={(v) => setStatus(v as "open" | "answered")} className="mb-4">
        <TabsList>
          <TabsTrigger value="open">Waiting for an answer</TabsTrigger>
          <TabsTrigger value="answered">Answered</TabsTrigger>
        </TabsList>
      </Tabs>
      {list.isPending ? (
        <SkeletonRows rows={4} />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : !list.data.length ? (
        <EmptyState
          icon={Inbox}
          title={status === "open" ? "Nothing waiting" : "Nothing answered yet"}
          description="Clients ask from the portal on their private link."
        />
      ) : (
        <div className="space-y-3">
          {list.data.map((r) => (
            <RequestCard key={r.id} r={r} canAnswer={can("clients", "edit")} />
          ))}
        </div>
      )}
    </>
  );
}
