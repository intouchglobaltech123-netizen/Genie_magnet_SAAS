"use client";

import { Download, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useDemo } from "@/lib/store";
import { agreementById, clientById, cycles, personById } from "@/lib/mock/core";
import { outcomes, type OutcomeKpi } from "@/lib/mock/delivery";
import { pct } from "@/lib/utils";

const nf = new Intl.NumberFormat("en-IN");
export const fmtKpi = (k: OutcomeKpi) => (k.key === "er" ? pct(k.value, 1) : k.value >= 100000 ? `${(k.value / 100000).toFixed(2)}L` : nf.format(k.value));

export function ReportDialog({ open, onOpenChange, clientId }: { open: boolean; onOpenChange: (o: boolean) => void; clientId: string }) {
  const videos = useDemo((s) => s.videos);
  const log = useDemo((s) => s.log);
  const data = outcomes.find((o) => o.clientId === clientId)!;
  const client = clientById(clientId);
  const cycle = cycles.find((c) => c.clientId === clientId && c.label === "Sep 2026");
  const agreement = cycle ? agreementById(cycle.agreementId) : undefined;
  const sep = videos.filter((v) => v.clientId === clientId && v.cycleId === cycle?.id);
  const delivered = sep.filter((v) => v.stage === "Approved" || v.stage === "Published").length;
  const owner = personById(client.accountOwnerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0">
        <DialogTitle className="sr-only">Monthly report preview</DialogTitle>
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3 pr-14">
          <span className="text-[13px] font-medium">Report preview</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => toast.success("PDF downloaded", { description: `${client.code}_Report_Sep-2026.pdf · 1 page · 284 KB` })}>
              <Download /> PDF
            </Button>
            <Button
              size="sm"
              variant="accent"
              onClick={() => {
                log(`September report shared with ${client.name} in Client Hub`, "success");
                toast.success("Shared with client", { description: `${client.contacts[0]?.name} will see it in their Client Hub and on email` });
                onOpenChange(false);
              }}
            >
              <Send /> Share with client
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 p-5">
          {/* The "paper" */}
          <article className="mx-auto rounded-xl border border-border bg-card p-8 shadow-card">
            <header className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Monthly performance report</div>
                <h2 className="mt-1 text-[24px] font-semibold tracking-tight">{client.name}</h2>
                <div className="mt-0.5 text-[13px] text-muted-foreground">
                  September 2026 · {agreement?.packageName ?? "Retainer"}
                </div>
              </div>
              <div className="text-right text-[12px] text-muted-foreground">
                <div className="font-semibold text-foreground">Genie Magnet</div>
                <div>Prepared by {owner.name}</div>
                <div>Issued 30 Sep 2026</div>
              </div>
            </header>

            <section className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-5">
              {data.kpis.map((k) => (
                <div key={k.key}>
                  <div className="text-[11px] text-muted-foreground">{k.label}</div>
                  <div className="text-[19px] font-semibold tabular">{fmtKpi(k)}</div>
                  <div className={k.delta >= 0 ? "text-[11px] text-success" : "text-[11px] text-danger"}>
                    {k.delta >= 0 ? "▲" : "▼"} {Math.abs(k.delta * 100).toFixed(0)}% vs Aug
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-6 border-t border-border py-5 sm:grid-cols-2">
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Highlights</h3>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed">
                  {data.highlights.map((h) => (
                    <li key={h} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Deliverables</h3>
                {cycle ? (
                  <>
                    <div className="mt-2 text-[28px] font-semibold tabular">
                      {delivered}
                      <span className="text-[15px] font-normal text-muted-foreground"> of {cycle.promised} approved</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-success" style={{ width: `${(delivered / cycle.promised) * 100}%` }} />
                    </div>
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      {sep.length - delivered} in progress · remaining units are tracked in the cycle and never silently carried forward.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[13px] text-muted-foreground">No active cycle.</p>
                )}
              </div>
            </section>

            <section className="border-t border-border py-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Top content</h3>
              <table className="mt-2 w-full text-[12.5px]">
                <tbody>
                  {data.topVideos.slice(0, 3).map((v) => (
                    <tr key={v.code} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3">{v.title}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{v.platform}</td>
                      <td className="py-2 pr-3 text-right tabular">{nf.format(v.views)} views</td>
                      <td className="py-2 text-right tabular">{v.leads} leads</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="border-t border-border pt-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Plan for October</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.nextMonth.map((n) => (
                  <span key={n} className="rounded-lg bg-muted px-2.5 py-1 text-[12.5px]">
                    {n}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-[10.5px] text-muted-foreground">
                Sources: {Array.from(new Set(data.kpis.map((k) => k.source))).join(" · ")}. Manually entered figures are marked in the portal.
              </p>
            </section>
          </article>
        </div>
      </DialogContent>
    </Dialog>
  );
}
