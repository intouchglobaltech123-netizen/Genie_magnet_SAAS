-- Invoice settings and GST invoices (P1-20).

-- CreateTable
CREATE TABLE "invoice_settings" (
    "agency_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "gstin" TEXT,
    "state" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "services" JSONB NOT NULL DEFAULT '[]',
    "number_format" TEXT NOT NULL,
    "number_series" TEXT,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 7,
    "bank_name" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "ifsc" TEXT,
    "upi_id" TEXT,
    "footer" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "agreement_id" UUID,
    "number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "period" TEXT,
    "issue_date" DATE,
    "due_date" DATE,
    "place_of_supply" TEXT,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "taxable" INTEGER NOT NULL DEFAULT 0,
    "cgst" INTEGER NOT NULL DEFAULT 0,
    "sgst" INTEGER NOT NULL DEFAULT 0,
    "igst" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "billed_to" JSONB,
    "seller" JSONB,
    "notes" TEXT,
    "sent_at" TIMESTAMP(3),
    "paid_on" DATE,
    "payment_note" TEXT,
    "cancel_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_agency_id_status_idx" ON "invoices"("agency_id", "status");

-- CreateIndex
CREATE INDEX "invoices_agency_id_client_id_idx" ON "invoices"("agency_id", "client_id");

-- CreateIndex
CREATE INDEX "invoices_agency_id_agreement_id_period_idx" ON "invoices"("agency_id", "agreement_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_agency_id_number_key" ON "invoices"("agency_id", "number");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "invoice_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoice_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invoices" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "invoice_settings" TO genie_app;
    -- Only drafts are ever deleted (issued invoices are cancelled, keeping their number).
    GRANT SELECT, INSERT, UPDATE, DELETE ON "invoices" TO genie_app;
  END IF;
END
$$;
