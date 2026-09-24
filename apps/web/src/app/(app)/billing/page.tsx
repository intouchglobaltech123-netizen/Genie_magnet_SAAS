"use client";

import { PageHeader } from "@/components/shared/page-header";
import { BillingHeaderActions, BillingView } from "@/features/finance/billing/billing-view";
import { NewInvoiceButton } from "@/features/finance/billing/dialogs";

export default function BillingPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Finance · Module 33"
        depth="preview"
        title="Billing & Collections"
        description="GST invoices, collections, advances and credit notes for FY 2026-27. Intra-state clients are billed CGST 9% + SGST 9%; out-of-state clients IGST 18%."
        actions={
          <>
            <BillingHeaderActions />
            <NewInvoiceButton />
          </>
        }
      />
      <BillingView />
    </div>
  );
}
