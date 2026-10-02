-- Closing a month's books (P5-05).

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'closed',
    "figures" JSONB NOT NULL DEFAULT '{}',
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopened_by" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopen_reason" TEXT,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_agency_id_month_key" ON "financial_periods"("agency_id", "month");

-- Row-level security.
ALTER TABLE "financial_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "financial_periods" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "financial_periods" TO genie_app;
  END IF;
END
$$;
