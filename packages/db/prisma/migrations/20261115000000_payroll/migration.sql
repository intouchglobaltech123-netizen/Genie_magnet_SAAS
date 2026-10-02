-- Payroll (P5-09): salaries in parts, the agency's own payroll rules, monthly runs and payslips.

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "earnings" JSONB NOT NULL,
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "agency_id" UUID NOT NULL,
    "day_basis" TEXT NOT NULL DEFAULT 'calendar',
    "lates_per_half_day" INTEGER,
    "deductions" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_by" TEXT,
    "locked_at" TIMESTAMP(3),
    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "person" JSONB NOT NULL,
    "days" JSONB NOT NULL,
    "earnings" JSONB NOT NULL,
    "deductions" JSONB NOT NULL,
    "contributions" JSONB NOT NULL DEFAULT '[]',
    "adjustments" JSONB NOT NULL DEFAULT '[]',
    "entries" JSONB NOT NULL DEFAULT '{}',
    "extra_lop" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gross" INTEGER NOT NULL,
    "total_deductions" INTEGER NOT NULL,
    "net" INTEGER NOT NULL,
    "employer_cost" INTEGER NOT NULL DEFAULT 0,
    "notes" JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_agency_id_user_id_from_key" ON "salary_structures"("agency_id", "user_id", "from");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_agency_id_month_key" ON "payroll_runs"("agency_id", "month");

-- CreateIndex
CREATE INDEX "payslips_agency_id_user_id_idx" ON "payslips"("agency_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_run_id_user_id_key" ON "payslips"("run_id", "user_id");

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security.
ALTER TABLE "salary_structures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "salary_structures" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "salary_structures" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "payroll_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payroll_runs" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payslips" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payslips" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "salary_structures", "payroll_settings", "payroll_runs", "payslips" TO genie_app;
  END IF;
END
$$;
