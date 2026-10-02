-- Finance and costing (P5-01, P5-02): cost rates, costing settings, vendors and expenses.

-- CreateTable
CREATE TABLE "person_cost_rates" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "monthly_cost" INTEGER NOT NULL,
    "hours_per_month" INTEGER NOT NULL DEFAULT 176,
    "effective_from" DATE NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_cost_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_settings" (
    "agency_id" UUID NOT NULL,
    "kit_rates" JSONB NOT NULL DEFAULT '{}',
    "monthly_overhead" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "vendor_id" UUID,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "gst" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "video_id" UUID,
    "client_id" UUID,
    "submitted_by" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_cost_rates_agency_id_user_id_idx" ON "person_cost_rates"("agency_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_cost_rates_agency_id_user_id_effective_from_key" ON "person_cost_rates"("agency_id", "user_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_agency_id_name_key" ON "vendors"("agency_id", "name");

-- CreateIndex
CREATE INDEX "expenses_agency_id_date_idx" ON "expenses"("agency_id", "date");

-- CreateIndex
CREATE INDEX "expenses_agency_id_status_idx" ON "expenses"("agency_id", "status");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security.
ALTER TABLE "person_cost_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person_cost_rates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "person_cost_rates" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "cost_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cost_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "vendors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendors" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "vendors" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "expenses" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "person_cost_rates", "cost_settings", "vendors", "expenses" TO genie_app;
  END IF;
END
$$;
