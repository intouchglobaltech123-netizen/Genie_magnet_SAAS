"use client";

import { useRef, useState } from "react";
import { ImageUp, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { type AgencyProfile, agencyProfileInput, type AgencyProfileInput, BUSINESS_STAGES, LANGUAGES } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError, errorMessage } from "./api";
import { useAgency, useCan, useHideSetup, useSetup, useUpdateAgency } from "./queries";

const STAGE_HINT: Record<(typeof BUSINESS_STAGES)[number], string> = {
  Struggle: "Finding steady clients and cash.",
  Survival: "Paying the bills; work depends on the founder.",
  Stability: "Steady income and a team that delivers.",
  Success: "Profitable, with systems that run without the founder.",
  Scale: "Growing into new services, cities or teams.",
};

/** Resizes a picked image to at most 256 px and returns it as a PNG data URL (kept small for the profile). */
function resizeLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return reject(new Error("Use a PNG, JPEG or WebP image."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 256 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const data = canvas.toDataURL("image/png");
      if (data.length > 300_000) reject(new Error("The logo is still too large — try a simpler image."));
      else resolve(data);
    };
    img.onerror = () => reject(new Error("That file could not be read as an image."));
    img.src = url;
  });
}

type Form = {
  name: string;
  logo: string | null;
  brandColor: string;
  businessStage: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  windowDays: string;
  reminderDays: number[];
  languages: string[];
  discountLimit: string;
  renewalNoticeDays: string;
};

const toForm = (a: AgencyProfile): Form => ({
  name: a.name,
  logo: a.logo,
  brandColor: a.brandColor ?? "",
  businessStage: a.businessStage ?? "",
  phone: a.phone ?? "",
  email: a.email ?? "",
  website: a.website ?? "",
  city: a.city ?? "",
  windowDays: String(a.windowDays),
  reminderDays: a.reminderDays,
  languages: a.languages,
  discountLimit: String(a.discountLimit),
  renewalNoticeDays: String(a.renewalNoticeDays),
});

function ProfileForm({ agency, canEdit }: { agency: AgencyProfile; canEdit: boolean }) {
  const save = useUpdateAgency();
  const [f, setF] = useState<Form>(() => toForm(agency));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newReminder, setNewReminder] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const dirty = JSON.stringify(f) !== JSON.stringify(toForm(agency));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      name: f.name,
      logo: f.logo,
      brandColor: f.brandColor || null,
      businessStage: (f.businessStage || null) as AgencyProfileInput["businessStage"],
      phone: f.phone,
      email: f.email,
      website: f.website,
      city: f.city,
      windowDays: Number(f.windowDays),
      reminderDays: f.reminderDays,
      languages: f.languages,
      discountLimit: Number(f.discountLimit),
      renewalNoticeDays: Number(f.renewalNoticeDays),
    };
    const parsed = agencyProfileInput.safeParse(input);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    save.mutate(parsed.data, {
      onSuccess: (a) => {
        setF(toForm(a));
        toast.success("Agency profile saved");
      },
      onError: (err) => {
        if (err instanceof ApiError && err.body.issues) setErrors(Object.fromEntries(err.body.issues.map((i) => [i.path.split(".")[0]!, i.message])));
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6">
        <SectionCard title="Your agency" description="Shown to your team, and to clients in the portal and on documents.">
          <div className="grid gap-5 md:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <Field label="Agency name" required error={errors.name}>
                <Input value={f.name} onChange={set("name")} />
              </Field>
              <Field label="Business stage" hint="Where your agency is today, in Growth OS terms." error={errors.businessStage}>
                <Select
                  value={f.businessStage || "_none"}
                  onValueChange={(v) => setF({ ...f, businessStage: v === "_none" ? "" : v })}
                  aria-label="Business stage"
                  options={[{ value: "_none", label: "Not set" }, ...BUSINESS_STAGES.map((s) => ({ value: s, label: `${s} — ${STAGE_HINT[s]}` }))]}
                />
              </Field>
              <Field label="Brand colour" hint="Used in the client portal and on documents." error={errors.brandColor}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pick the brand colour"
                    value={f.brandColor || "#1E3A8A"}
                    onChange={(e) => setF({ ...f, brandColor: e.target.value.toUpperCase() })}
                    className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-surface p-1"
                  />
                  <Input value={f.brandColor} onChange={set("brandColor")} placeholder="#1E3A8A" className="w-32 font-mono" />
                  {f.brandColor && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, brandColor: "" })}>
                      Clear
                    </Button>
                  )}
                </div>
              </Field>
            </div>
            <div>
              <div className="mb-1.5 text-body font-medium text-text-secondary">Logo</div>
              <div className="flex aspect-square w-full max-w-[220px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-secondary">
                {f.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a data URL, not a remote image
                  <img src={f.logo} alt="Agency logo" className="max-h-full max-w-full object-contain p-3" />
                ) : (
                  <ImageUp className="size-8 text-text-muted" />
                )}
              </div>
              {canEdit && (
                <div className="mt-2 flex gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        setF({ ...f, logo: await resizeLogo(file) });
                      } catch (err) {
                        toast.error(errorMessage(err));
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <ImageUp />
                    {f.logo ? "Change" : "Upload"}
                  </Button>
                  {f.logo && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setF({ ...f, logo: null })}>
                      <Trash2 />
                      Remove
                    </Button>
                  )}
                </div>
              )}
              {errors.logo && <p className="mt-1 text-body text-danger">{errors.logo}</p>}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Contact details" description="For proposals, invoices and the client portal.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" error={errors.phone}>
              <Input value={f.phone} onChange={set("phone")} placeholder="+91 98400 11000" />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={f.email} onChange={set("email")} />
            </Field>
            <Field label="Website" error={errors.website}>
              <Input value={f.website} onChange={set("website")} placeholder="https://" />
            </Field>
            <Field label="City" error={errors.city}>
              <Input value={f.city} onChange={set("city")} />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Client onboarding"
          description="What clients must answer first unlocks the work; the deeper questions follow within this window, with reminders."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Days to finish the deeper questions" hint="Growth OS default: 7 days." error={errors.windowDays}>
              <Input type="number" min={1} max={60} value={f.windowDays} onChange={set("windowDays")} className="w-28" />
            </Field>
            <div className="space-y-1.5">
              <div className="text-body font-medium text-text-secondary">Send reminders on day</div>
              <div className="flex flex-wrap items-center gap-2">
                {f.reminderDays.map((d) => (
                  <Badge key={d} tone="accent" className="gap-1.5">
                    Day {d}
                    {canEdit && (
                      <button
                        type="button"
                        aria-label={`Remove the day ${d} reminder`}
                        className="cursor-pointer"
                        onClick={() => setF({ ...f, reminderDays: f.reminderDays.filter((x) => x !== d) })}
                      >
                        <X />
                      </button>
                    )}
                  </Badge>
                ))}
                {canEdit && f.reminderDays.length < 5 && (
                  <span className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      aria-label="Add a reminder on day"
                      placeholder="Day"
                      value={newReminder}
                      onChange={(e) => setNewReminder(e.target.value)}
                      className="h-7 w-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      disabled={!Number(newReminder)}
                      onClick={() => {
                        const d = Math.round(Number(newReminder));
                        if (d >= 1) setF({ ...f, reminderDays: [...new Set([...f.reminderDays, d])].sort((a, b) => a - b) });
                        setNewReminder("");
                      }}
                    >
                      <Plus />
                      Add
                    </Button>
                  </span>
                )}
              </div>
              {errors.reminderDays ? (
                <p className="text-body text-danger">{errors.reminderDays}</p>
              ) : (
                <p className="text-body text-muted-foreground">Growth OS default: day 2 and day 5. A flag is raised when the window ends.</p>
              )}
            </div>
          </div>
          <div className="mt-5 space-y-1.5">
            <div className="text-body font-medium text-text-secondary">Languages you use with clients</div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {LANGUAGES.map((l) => (
                <label key={l.code} className="flex items-center gap-2 text-body">
                  <Checkbox
                    checked={f.languages.includes(l.code)}
                    onCheckedChange={(on) => setF({ ...f, languages: on === true ? [...f.languages, l.code] : f.languages.filter((c) => c !== l.code) })}
                  />
                  {l.label}
                </label>
              ))}
            </div>
            {errors.languages ? (
              <p className="text-body text-danger">{errors.languages}</p>
            ) : (
              <p className="text-body text-muted-foreground">Questionnaires can be translated into these.</p>
            )}
          </div>
        </SectionCard>
        <SectionCard
          title="Sales and agreements"
          description="How much discount a salesperson can give on their own, and when renewals come up."
          contentClassName="space-y-4"
        >
          <Field
            label="Discount without approval (%)"
            hint="Growth OS default: 10%. Above this, a proposal waits for someone who may approve sales (the owner and managers by default)."
            error={errors.discountLimit}
          >
            <Input type="number" min={0} max={50} value={f.discountLimit} onChange={set("discountLimit")} className="w-28" />
          </Field>
          <Field
            label="Renewal notice (days)"
            hint="Growth OS default: 45. An agreement shows as due for renewal this many days before it ends."
            error={errors.renewalNoticeDays}
          >
            <Input type="number" min={7} max={120} value={f.renewalNoticeDays} onChange={set("renewalNoticeDays")} className="w-28" />
          </Field>
        </SectionCard>
      </fieldset>

      {canEdit ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          {save.error && !(save.error instanceof ApiError && save.error.body.issues) && (
            <span className="mr-auto text-body text-danger">{errorMessage(save.error)}</span>
          )}
          <Button type="button" variant="secondary" disabled={!dirty} onClick={() => setF(toForm(agency))}>
            Undo changes
          </Button>
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        <Alert tone="info">You can see the agency profile; an owner or manager can change it.</Alert>
      )}
    </form>
  );
}

export function LiveAgencyProfile() {
  const can = useCan();
  const agency = useAgency();
  const setup = useSetup();
  const showSetup = useHideSetup();
  return (
    <>
      <PageHeader
        title="Agency profile"
        description="Your agency's name, look and contact details, and how client onboarding works."
        actions={
          setup.data?.hidden &&
          can("settings", "edit") && (
            <Button
              variant="ghost"
              size="sm"
              disabled={showSetup.isPending}
              onClick={() => showSetup.mutate(false, { onSuccess: () => toast.success("The set-up guide is back on Home") })}
            >
              Show the set-up guide again
            </Button>
          )
        }
      />
      {agency.isPending ? (
        <SkeletonRows rows={8} />
      ) : agency.error ? (
        <Alert tone="danger">{errorMessage(agency.error)}</Alert>
      ) : (
        <ProfileForm key={agency.data.id} agency={agency.data} canEdit={can("settings", "edit")} />
      )}
    </>
  );
}
