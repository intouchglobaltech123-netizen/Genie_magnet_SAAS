"use client";

import { BadgeIndianRupee, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDemo } from "@/lib/store";
import { PORTAL_CLIENT_ID, PORTAL_USER } from "@/lib/mock/portal";
import { inr } from "@/lib/utils";

/** Out-of-scope estimates the agency has sent — client approves or declines here. */
export function PortalEstimates() {
  const videos = useDemo((s) => s.videos);
  const crs = useDemo((s) => s.changeRequests);
  const update = useDemo((s) => s.updateChangeRequest);
  const log = useDemo((s) => s.log);

  const mine = crs.filter((c) => {
    if (c.status !== "awaiting-client") return false;
    if (c.videoId === `new:${PORTAL_CLIENT_ID}`) return true;
    return videos.find((v) => v.id === c.videoId)?.clientId === PORTAL_CLIENT_ID;
  });
  if (mine.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[16px] font-semibold tracking-tight">Estimates awaiting your decision</h2>
      <div className="space-y-3">
        {mine.map((c) => {
          const video = videos.find((v) => v.id === c.videoId);
          return (
            <Card key={c.id} className="flex flex-col gap-4 border-warning/30 p-5 md:flex-row md:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                <BadgeIndianRupee className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-muted-foreground">{video ? video.title : "New request"}</div>
                <div className="mt-0.5 text-[14px] font-medium">{c.summary.replace(/^Client request · /, "")}</div>
                <div className="mt-1 text-[12.5px] text-muted-foreground">
                  Outside your monthly package · {c.dateImpactDays ? `adds ${c.dateImpactDays} working days` : "no change to dates"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[20px] font-semibold tabular">{inr(c.estimate ?? 0)}</div>
                <div className="text-[11.5px] text-muted-foreground">+ GST · billed on next invoice</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    update(c.id, { status: "rejected" });
                    log(`${PORTAL_USER.name} declined estimate ${inr(c.estimate ?? 0)}`, "warning");
                    toast("Estimate declined", { description: "No work or charges will be added." });
                  }}
                >
                  <X /> Decline
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => {
                    update(c.id, { status: "approved" });
                    log(`${PORTAL_USER.name} approved estimate ${inr(c.estimate ?? 0)} in the client portal`, "success");
                    toast.success("Estimate approved", { description: "Your team has been notified and will start right away." });
                  }}
                >
                  <Check /> Approve {inr(c.estimate ?? 0)}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
