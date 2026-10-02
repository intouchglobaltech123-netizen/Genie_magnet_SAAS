"use client";

import { ExternalLink } from "lucide-react";
import { METRIC_KEYS, METRIC_LABEL, type MonthlyReport, type MonthlyReportData } from "@gm/shared";
import { PLATFORM_LABEL } from "./packages";

const n = (v: number) => new Intl.NumberFormat("en-IN").format(v);
const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="text-[12px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {sub && <div className="text-[12px] text-neutral-500">{sub}</div>}
    </div>
  );
}

/**
 * The monthly report as the client sees and prints it (P3-09): in the agency's name and colour, what the month
 * delivered, each post with its link and numbers, the team's note, and next month's topics.
 */
export function ReportDocument({ report }: { report: Pick<MonthlyReport, "month" | "note" | "status" | "data"> }) {
  const data: MonthlyReportData = report.data;
  const brand = data.agency.brandColor ?? "#1E3A8A";
  const t = data.totals;
  return (
    <article className="relative mx-auto max-w-[820px] rounded-xl bg-white p-8 text-[13px] leading-relaxed text-neutral-900 shadow-card print:max-w-none print:rounded-none print:p-0 print:shadow-none sm:p-10">
      {report.status === "draft" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden print:hidden" aria-hidden>
          <span className="-rotate-12 select-none text-[96px] font-bold tracking-widest text-neutral-200/70">DRAFT</span>
        </div>
      )}
      <header className="flex items-start justify-between gap-4 border-b-4 pb-4" style={{ borderColor: brand }}>
        <div className="flex items-center gap-3">
          {data.agency.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- the agency's logo, a small data URL
            <img src={data.agency.logo} alt="" className="size-12 object-contain" />
          ) : (
            <span className="inline-flex size-12 items-center justify-center rounded-lg text-xl font-bold text-white" style={{ background: brand }}>
              {data.agency.name[0]}
            </span>
          )}
          <div>
            <div className="text-neutral-500">{data.agency.name}</div>
            <h1 className="text-xl font-semibold">{data.client.name}</h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] uppercase tracking-wide text-neutral-500">Monthly report</div>
          <div className="text-lg font-semibold">{monthName(data.month)}</div>
        </div>
      </header>

      <section className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Videos delivered"
          value={`${data.delivered} of ${data.promised}`}
          sub={data.carriedIn ? `incl. ${data.carriedIn} carried in` : undefined}
        />
        <Tile label="Posts" value={n(t.posts)} />
        <Tile label="Views" value={n(t.views)} />
        <Tile label="Likes" value={n(t.likes)} sub={`${n(t.comments)} comments · ${n(t.shares)} shares`} />
      </section>

      {report.note && <p className="relative mt-5 whitespace-pre-line rounded-lg bg-neutral-50 p-4">{report.note}</p>}

      <section className="relative mt-6">
        <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">The month&apos;s videos</h2>
        {data.videos.length ? (
          <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
            {data.videos.map((v) => (
              <li key={v.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium">{v.title}</span> <span className="text-neutral-500">{v.code}</span>
                  </span>
                  <span className={v.delivered ? "text-green-700" : "text-neutral-500"}>{v.delivered ? "Delivered" : "In the making"}</span>
                </div>
                {v.posts.map((p) => (
                  <div key={p.id} className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-600">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-neutral-900 underline-offset-2 hover:underline"
                      >
                        {PLATFORM_LABEL[p.platform] ?? p.platform}
                        <ExternalLink className="size-3 print:hidden" />
                      </a>
                    ) : (
                      <span>{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                    )}
                    {p.metrics &&
                      METRIC_KEYS.filter((k) => p.metrics![k] != null).map((k) => (
                        <span key={k}>
                          {n(p.metrics![k]!)} {METRIC_LABEL[k].toLowerCase()}
                        </span>
                      ))}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-500">No videos this month.</p>
        )}
      </section>

      {data.nextMonth.length > 0 && (
        <section className="relative mt-6">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Coming next month</h2>
          <ul className="list-inside list-disc">
            {data.nextMonth.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
