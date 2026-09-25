"use client";

import * as React from "react";
import { Boxes, CalendarPlus, IndianRupee, PackageOpen, Search, TrendingDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { assets as seedAssets, personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Asset } from "@/lib/types";
import { fmtDate, inr, inrCompact } from "@/lib/utils";
import { AssetDetail } from "./asset-detail";
import { CostingCard } from "./costing-card";
import { CATEGORIES, CONDITION_TONE, INCIDENT_STEPS, STATUS_META, annualDepreciation, bookValue, perHourCost, seedReservations, type Reservation } from "./data";
import { IncidentCard } from "./incident-card";
import { ReserveDialog } from "./reserve-dialog";

export function AssetsView() {
  const [assets, setAssets] = React.useState<Asset[]>(seedAssets);
  const [reservations, setReservations] = React.useState<Reservation[]>(seedReservations);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [openTag, setOpenTag] = React.useState<string | null>(null);
  const [reserveTag, setReserveTag] = React.useState<string | null>(null);
  const [incidentDone, setIncidentDone] = React.useState(1);
  const [incidentStamps, setIncidentStamps] = React.useState<string[]>(["22 Sep"]);

  const filtered = assets.filter((a) => {
    if (cat !== "all" && a.category !== cat) return false;
    if (status !== "all" && a.status !== status) return false;
    if (q.trim()) {
      const s = q.toLowerCase();
      const cust = a.custodianId ? personById(a.custodianId).name.toLowerCase() : "";
      return a.name.toLowerCase().includes(s) || a.tag.toLowerCase().includes(s) || cust.includes(s);
    }
    return true;
  });

  const totalValue = assets.reduce((s, a) => s + a.purchaseValue, 0);
  const totalBook = assets.reduce((s, a) => s + bookValue(a), 0);
  const checkedOut = assets.filter((a) => a.status === "checked-out").length;
  const inMaint = assets.filter((a) => a.status === "maintenance").length;
  const openAsset = assets.find((a) => a.tag === openTag) ?? null;

  function advanceIncident() {
    const i = incidentDone;
    const step = INCIDENT_STEPS[i]!;
    setIncidentDone(i + 1);
    setIncidentStamps((s) => {
      const n = [...s];
      n[i] = step.date || "25 Sep";
      return n;
    });
    const log = useDemo.getState().log;
    if (i === 1) {
      toast("Sent for repair", { description: "Sound Wave Service Centre, Coimbatore · est. ₹3,500 · ETA 2 days" });
      log("GM-AUD-02 Rode NTG4+ sent to Sound Wave Service Centre, Coimbatore", "warning");
    } else if (i === 2) {
      toast.success("Reinspection passed", { description: "Naveen verified clean XLR output — no crackle." });
      log("GM-AUD-02 passed reinspection");
    } else {
      setAssets((prev) => prev.map((a) => (a.tag === "GM-AUD-02" ? { ...a, status: "available", condition: "Good" } : a)));
      toast.success("Rode NTG4+ back in service", { description: "Status → Available · Condition → Good" });
      log("GM-AUD-02 Rode NTG4+ back in service (repair ₹3,500)", "success");
    }
  }

  function confirmReservation(r: Omit<Reservation, "id">) {
    setReservations((prev) => [...prev, { ...r, id: `rs-${Date.now()}` }]);
    setReserveTag(null);
    const a = assets.find((x) => x.tag === r.tag);
    const who = personById(r.personId).name;
    toast.success("Reservation confirmed", { description: `${r.tag} ${a?.name ?? ""} · ${fmtDate(r.date, { day: "numeric", month: "short" })} · ${who}` });
    useDemo.getState().log(`${r.tag} reserved for ${who} on ${fmtDate(r.date, { day: "numeric", month: "short" })} — ${r.purpose}`, "accent");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        depth="preview"
        title="Equipment & Assets"
        className="mb-0"
        description="Every camera, lens, light and workstation — who has it, what it's worth, and what each hour of use costs a project."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast("Asset register exported (demo)", { description: "GM_Asset_Register_Sep2026.xlsx · 17 items" })}>
              Export register
            </Button>
            <Button variant="accent" size="sm" onClick={() => setReserveTag("GM-CAM-01")}>
              <CalendarPlus /> Reserve equipment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total asset value" value={inrCompact(totalValue)} icon={IndianRupee} hint={`${assets.length} items at cost`} />
        <StatCard label="Current book value" value={inrCompact(totalBook)} icon={TrendingDown} tone="info" hint={`${Math.round((1 - totalBook / totalValue) * 100)}% depreciated`} />
        <StatCard label="Checked out" value={checkedOut} icon={PackageOpen} tone="accent" hint="On shoots or at desks" />
        <StatCard label="In maintenance" value={inMaint} icon={Wrench} tone={inMaint ? "warning" : "success"} hint={inMaint ? "1 open incident" : "All gear in service"} />
      </div>

      <CostingCard assets={assets} />

      <IncidentCard done={incidentDone} stamps={incidentStamps} onAdvance={advanceIncident} onOpenAsset={() => setOpenTag("GM-AUD-02")} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tag, item or custodian…" aria-label="Search assets" className="pl-9" />
          </div>
          <Select
            className="md:w-44"
            value={cat}
            onValueChange={setCat}
            options={[{ value: "all", label: "All categories" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
          <Select
            className="md:w-44"
            value={status}
            onValueChange={setStatus}
            options={[{ value: "all", label: "All statuses" }, ...Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))]}
          />
        </div>
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Tag</TH>
              <TH>Item</TH>
              <TH>Status</TH>
              <TH>Custodian</TH>
              <TH>Condition</TH>
              <TH numeric>Hours</TH>
              <TH numeric>Book value</TH>
              <TH numeric>Depr. / yr</TH>
              <TH numeric className="pr-5">Cost / hr</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((a) => {
              const st = STATUS_META[a.status];
              const hourly = perHourCost(a);
              const cust = a.custodianId ? personById(a.custodianId) : null;
              return (
                <TR key={a.id} className="cursor-pointer" onClick={() => setOpenTag(a.tag)}>
                  <TD className="pl-5 font-mono text-body text-muted-foreground">{a.tag}</TD>
                  <TD>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-body text-muted-foreground">{a.category}</div>
                  </TD>
                  <TD>
                    <Badge tone={st.tone} dot>
                      {st.label}
                    </Badge>
                  </TD>
                  <TD>
                    {cust ? (
                      <span className="inline-flex items-center gap-2">
                        <Avatar name={cust.name} size="sm" />
                        <span className="whitespace-nowrap">{cust.name.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Equipment room</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={CONDITION_TONE[a.condition]}>{a.condition}</Badge>
                  </TD>
                  <TD numeric>{a.hoursUsed ? a.hoursUsed.toLocaleString("en-IN") : <span className="text-muted-foreground">—</span>}</TD>
                  <TD numeric>{inr(bookValue(a))}</TD>
                  <TD numeric>{inr(annualDepreciation(a))}</TD>
                  <TD numeric className="pr-5 font-medium">{hourly === null ? <span className="font-normal text-muted-foreground">n/a</span> : `${inr(hourly)}`}</TD>
                </TR>
              );
            })}
            {filtered.length === 0 && (
              <TR className="hover:bg-transparent">
                <TD colSpan={9} className="px-5">
                  <EmptyState
                    compact
                    icon={Boxes}
                    title="No assets match these filters"
                    description="Try another search term, category or status."
                    action={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQ("");
                          setCat("all");
                          setStatus("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-body text-muted-foreground">
          <span>
            Showing {filtered.length} of {assets.length} items · click a row for depreciation, custody & reservations
          </span>
          <span className="tabular">Book value shown {inr(filtered.reduce((s, a) => s + bookValue(a), 0))}</span>
        </div>
      </Card>

      <AssetDetail
        asset={openAsset}
        reservations={reservations}
        onOpenChange={(o) => !o && setOpenTag(null)}
        onReserve={(tag) => setReserveTag(tag)}
      />
      <ReserveDialog
        open={reserveTag !== null}
        onOpenChange={(o) => !o && setReserveTag(null)}
        assets={assets}
        initialTag={reserveTag ?? "GM-CAM-01"}
        reservations={reservations}
        onConfirm={confirmReservation}
      />
    </div>
  );
}
