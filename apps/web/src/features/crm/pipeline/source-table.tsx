"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { LEAD_STAGES, sourceHistory } from "@/lib/mock/crm";
import { useDemo } from "@/lib/store";
import type { Lead } from "@/lib/types";
import { cn, inrCompact, pct } from "@/lib/utils";
import { sourceTone } from "./lead-card";

export function SourceTable() {
  const leads = useDemo((s) => s.leads);
  const rows = (Object.keys(sourceHistory) as Lead["source"][])
    .map((src) => {
      const h = sourceHistory[src];
      const live = leads.filter((l) => l.source === src);
      const qualified = live.filter((l) => LEAD_STAGES.indexOf(l.stage) >= 2 && l.stage !== "Lost").length;
      const won = live.filter((l) => l.stage === "Won");
      const total = h.leads + live.length;
      const q = h.qualified + qualified;
      const w = h.won + won.length;
      return { src, total, q, w, conv: total ? w / total : 0, revenue: h.revenue + won.reduce((s, l) => s + l.value, 0), open: live.filter((l) => l.stage !== "Won" && l.stage !== "Lost").length };
    })
    .sort((a, b) => b.conv - a.conv);
  const best = Math.max(...rows.map((r) => r.conv));
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Source performance</CardTitle>
          <CardDescription>Last 6 months including live pipeline · where to spend the next marketing rupee</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <Table>
          <THead>
            <TR>
              <TH>Source</TH>
              <TH className="text-right">Leads</TH>
              <TH className="text-right">Qualified</TH>
              <TH className="text-right">Won</TH>
              <TH>Conversion</TH>
              <TH className="text-right">Open now</TH>
              <TH className="text-right">Won MRR</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.src}>
                <TD>
                  <Badge tone={sourceTone[r.src]}>{r.src}</Badge>
                </TD>
                <TD className="text-right tabular">{r.total}</TD>
                <TD className="text-right tabular">
                  {r.q} <span className="text-muted-foreground">({r.total ? pct(r.q / r.total) : "—"})</span>
                </TD>
                <TD className="text-right font-medium tabular">{r.w}</TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", r.conv === best ? "bg-success" : "bg-accent")} style={{ width: `${(r.conv / best) * 100}%` }} />
                    </div>
                    <span className={cn("tabular", r.conv === best && "font-semibold text-success")}>{pct(r.conv)}</span>
                  </div>
                </TD>
                <TD className="text-right tabular">{r.open}</TD>
                <TD className="text-right font-medium tabular">{r.revenue ? inrCompact(r.revenue) : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="px-3 pb-2 pt-3 text-[12px] text-muted-foreground">
          Referrals and BNI convert 4–6× better than paid ads. Meta Ads bring volume but only ~6% close — consider a referral incentive for existing clients.
        </p>
      </CardContent>
    </Card>
  );
}
