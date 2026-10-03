"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { errorMessage } from "./api";
import { useChangePassword, useMe } from "./queries";

/** The sign-in library's answers, in plain words. */
function why(e: unknown) {
  const m = errorMessage(e);
  if (/invalid password/i.test(m)) return "Your current password is not right.";
  if (/credential account not found/i.test(m)) return "Your account has no password yet. Sign out and use “Forgot your password?” to choose one.";
  if (/too short/i.test(m)) return "The new password needs at least 10 characters.";
  return m;
}

/** Your account (password self-service): changing your own password while signed in. */
export function LiveAccount() {
  const me = useMe().data;
  const change = useChangePassword();
  const [f, setF] = useState({ current: "", next: "", again: "", others: true });
  const mismatch = f.again.length > 0 && f.next !== f.again;
  return (
    <>
      <PageHeader title="Your account" description={me ? `${me.user.name} · ${me.user.email}` : undefined} />
      <SectionCard title="Change your password" description="At least 10 characters. Choose one you do not use anywhere else." className="max-w-xl">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (mismatch) return;
            change.mutate(
              { currentPassword: f.current, newPassword: f.next, revokeOtherSessions: f.others },
              {
                onSuccess: () => {
                  setF({ current: "", next: "", again: "", others: f.others });
                  toast.success(f.others ? "Password changed, and your other devices are signed out" : "Password changed");
                },
              },
            );
          }}
        >
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" required value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          </Field>
          <Field label="New password">
            <Input type="password" autoComplete="new-password" required minLength={10} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
          </Field>
          <Field label="The same again" error={mismatch ? "The two passwords are not the same" : undefined}>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={f.again}
              onChange={(e) => setF({ ...f, again: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-body">
            <Checkbox checked={f.others} onCheckedChange={(v) => setF({ ...f, others: v === true })} />
            Sign out my other devices
          </label>
          {change.error && <Alert tone="danger">{why(change.error)}</Alert>}
          <Button type="submit" variant="accent" disabled={change.isPending || mismatch}>
            <KeyRound /> {change.isPending ? "Saving…" : "Change password"}
          </Button>
        </form>
        <p className="mt-4 text-body text-muted-foreground">
          Forgotten it? Sign out and use{" "}
          <Link href="/app/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>{" "}
          on the sign-in page.
        </p>
      </SectionCard>
    </>
  );
}
