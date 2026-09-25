"use client";

import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsView } from "@/features/finance/reports/reports-view";

export default function FinancePage() {
  return (
    <div>
      <PageHeader
        eyebrow="Finance · Module 36"
        depth="preview"
        title="Financial Reports"
        description="Contracted, invoiced, earned and collected revenue; progress against the FY 2026-27 Business Aspiration; cash, budgets, P&L and period locks."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast.success("Board pack exported", { description: "GenieMagnet_FinancePack_Sep-2026.pdf · 6 pages" })}
            >
              <Download /> Export pack
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => toast.success("Shared with Janarthanan & CA", { description: "Read-only link to Sep 2026 reports sent on email" })}
            >
              <Share2 /> Share with CA
            </Button>
          </>
        }
      />
      <ReportsView />
    </div>
  );
}
