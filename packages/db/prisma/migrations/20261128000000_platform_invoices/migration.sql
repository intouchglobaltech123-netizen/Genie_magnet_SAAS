-- Billing (P6-04): our invoices to agencies for their plans.

-- CreateTable
CREATE TABLE "platform_invoices" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issued_on" DATE NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "plan_key" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "amount" INTEGER NOT NULL,
    "cgst" INTEGER NOT NULL DEFAULT 0,
    "sgst" INTEGER NOT NULL DEFAULT 0,
    "igst" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "gst_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seller" JSONB NOT NULL,
    "buyer" JSONB NOT NULL,
    "sac" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL,
    "payment_ref" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_invoices_number_key" ON "platform_invoices"("number");

-- CreateIndex
CREATE INDEX "platform_invoices_agency_id_issued_on_idx" ON "platform_invoices"("agency_id", "issued_on");

-- CreateIndex
CREATE UNIQUE INDEX "platform_invoices_provider_payment_ref_key" ON "platform_invoices"("provider", "payment_ref");


-- Row-level security: each agency reads its own; the platform issues them, numbered across the platform.
ALTER TABLE "platform_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "platform_invoices" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY platform_invoices ON "platform_invoices" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_invoices" TO genie_app;
  END IF;
END
$$;
