"use client";

import { useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { toast } from "sonner";
import { SUPPORT_LEVEL_LABEL, SUPPORT_LEVELS, type SupportLevel } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { errorMessage } from "./api";
import { useCan, useMe, useSupportAction, useSupportGrants } from "./queries";

const when = (at: string) => new Date(at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Settings → Support access (P6-08): letting the platform's support team in, for a while, and taking it back. */
export function LiveSupportAccess() {
  const q = useSupportGrants();
  const can = useCan();
  const me = useMe().data;
  const act = useSupportAction();
  const [f, setF] = useState({ hours: "4", level: "view" as SupportLevel, reason: "" });
  const mayGrant = can("settings", "edit") && !me?.support;
  return (
    <>
      <PageHeader
        title="Support access"
        description="The platform's support team cannot see your agency unless you let them in: for the hours you choose, seeing only or also fixing, for the reason you give. Everything they do is in your audit log; salaries and people's personal planners stay closed to them."
      />
      {mayGrant && (
        <SectionCard title="Let support in" className="mb-5">
          <div className="grid gap-3 sm:grid-cols-[10rem_12rem_1fr_auto] sm:items-end">
            <Field label="For">
              <Select
                value={f.hours}
                onValueChange={(v) => setF({ ...f, hours: v })}
                options={[
                  { value: "1", label: "1 hour" },
                  { value: "4", label: "4 hours" },
                  { value: "24", label: "A day" },
                  { value: "72", label: "Three days" },
                ]}
              />
            </Field>
            <Field label="They may">
              <Select
                value={f.level}
                onValueChange={(v) => setF({ ...f, level: v as SupportLevel })}
                options={SUPPORT_LEVELS.map((l) => ({ value: l, label: SUPPORT_LEVEL_LABEL[l] }))}
              />
            </Field>
            <Field label="What should they look at">
              <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Invoices will not send" />
            </Field>
            <Button
              variant="accent"
              disabled={act.isPending || f.reason.trim().length < 3}
              onClick={() =>
                act.mutate(
                  { step: "grant", body: { hours: Number(f.hours), level: f.level, reason: f.reason } },
                  { onSuccess: () => (setF({ ...f, reason: "" }), toast.success("Support can come in")), onError: (e) => toast.error(errorMessage(e)) },
                )
              }
            >
              <LifeBuoy /> Let them in
            </Button>
          </div>
        </SectionCard>
      )}
      {q.isPending ? (
        <SkeletonRows rows={3} />
      ) : q.error ? (
        <Alert tone="danger">{errorMessage(q.error)}</Alert>
      ) : !q.data.length ? (
        <Card className="p-6">
          <EmptyState icon={LifeBuoy} title="Support has never been let in" description="When you need help, let the support team in here for a few hours." />
        </Card>
      ) : (
        <ul className="space-y-2">
          {q.data.map((g) => (
            <li key={g.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-body font-medium">
                    {g.reason}
                    <Badge tone={g.active ? "success" : "neutral"}>{g.active ? `Open until ${when(g.expiresAt)}` : g.revokedAt ? "Taken back" : "Ended"}</Badge>
                    <Badge tone="outline">{SUPPORT_LEVEL_LABEL[g.level]}</Badge>
                  </div>
                  <div className="text-body text-muted-foreground">
                    Let in by {g.grantedBy.name} on {when(g.createdAt)}
                    {g.lastUsedAt ? ` · support came in ${when(g.lastUsedAt)}` : " · support has not come in"}
                    {g.revokedBy ? ` · taken back by ${g.revokedBy.name}` : ""}
                  </div>
                </div>
                {g.active && mayGrant && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate(
                        { step: "revoke", id: g.id },
                        { onSuccess: () => toast("Support access taken back"), onError: (e) => toast.error(errorMessage(e)) },
                      )
                    }
                  >
                    <X /> Take back
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
