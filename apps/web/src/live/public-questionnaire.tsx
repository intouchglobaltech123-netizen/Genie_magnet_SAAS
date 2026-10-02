"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Languages, LinkIcon } from "lucide-react";
import type { AnswerValue, PublicQuestionnaire as View } from "@gm/shared";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { api, ApiError, errorMessage } from "./api";
import { fmtDate } from "./format";
import { QuestionnaireForm } from "./questionnaire";

/**
 * The client's private link (P1-22): no sign-in, the agency's name and colours, the client's language, and answers that
 * save as they go. Opens at the first question still to answer.
 */
export function PublicQuestionnaire({ token }: { token: string }) {
  const qc = useQueryClient();
  const key = ["public-questionnaire", token];
  const view = useQuery({ queryKey: key, queryFn: () => api<View>(`/public/onboarding/${token}`), staleTime: Infinity });

  if (view.isPending)
    return (
      <div className="mx-auto max-w-5xl p-6">
        <SkeletonRows rows={8} />
      </div>
    );
  if (view.error) {
    const gone = view.error instanceof ApiError && view.error.status === 404;
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <LinkIcon className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-subheading font-semibold">{gone ? "This link does not work any more" : "Something went wrong"}</h1>
          <p className="mt-2 text-body text-muted-foreground">
            {gone ? "It may have been replaced by a newer link. Ask your agency to send it again." : errorMessage(view.error)}
          </p>
        </div>
      </div>
    );
  }

  const v = view.data;
  const brand = v.agency.brandColor ?? "#1E3A8A";
  const save = (k: string, value: AnswerValue) => api(`/public/onboarding/${token}/answers/${k}`, { method: "PUT", body: { value } });
  const required = v.sections.filter((s) => s.when === "required").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card" style={{ borderTop: `4px solid ${brand}` }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {v.agency.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
              <img src={v.agency.logo} alt="" className="size-10 rounded-lg object-contain" />
            ) : (
              <span className="inline-flex size-10 items-center justify-center rounded-lg text-subheading font-bold text-white" style={{ background: brand }}>
                {v.agency.name[0]}
              </span>
            )}
            <div>
              <div className="text-body text-muted-foreground">{v.agency.name}</div>
              <h1 className="text-subheading font-semibold">Welcome, {v.client.name}</h1>
            </div>
          </div>
          {v.languages.length > 1 && (
            <label className="flex items-center gap-2 text-body text-muted-foreground">
              <Languages className="size-4" />
              <span className="sr-only">Language</span>
              <Select
                aria-label="Language"
                value={v.language}
                className="w-40"
                onValueChange={async (language) => {
                  const next = await api<View>(`/public/onboarding/${token}/language`, { method: "PUT", body: { language } });
                  qc.setQueryData(key, next);
                }}
                options={v.languages.map((l) => ({ value: l.code, label: l.label }))}
              />
            </label>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Alert tone="info" className="mb-6">
          The first {required === 1 ? "section is" : `${required} sections are`} needed before we start work. The rest can be answered within {v.window.days}{" "}
          days
          {v.window.dueOn ? ` (by ${fmtDate(v.window.dueOn)})` : ""}. Everything saves as you type — you can close this page and come back to the same link.
        </Alert>
        {/* The language decides the wording, so the form starts again when it changes. */}
        <QuestionnaireForm
          key={v.language}
          sections={v.sections}
          initial={v.answers}
          windowDays={v.window.days}
          dueOn={v.window.dueOn}
          mode="public"
          save={save}
        />
      </main>
    </div>
  );
}
