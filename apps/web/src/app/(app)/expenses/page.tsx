"use client";

import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ExpensesView } from "@/features/finance/expenses/expenses-view";
import { NewExpenseButton } from "@/features/finance/expenses/new-expense";

export default function ExpensesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Finance · Module 34"
        depth="preview"
        title="Expenses & Vendors"
        description="Expense requests with receipts, policy checks and approvals — every rupee allocated to a client video or an overhead pool so True Costing stays honest."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("September expense register exported", { description: "Expenses_Sep-2026.xlsx · with GST input credit summary for GSTR-3B" })}
            >
              <Download /> Export register
            </Button>
            <NewExpenseButton />
          </>
        }
      />
      <ExpensesView />
    </div>
  );
}
