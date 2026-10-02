-- Daily data sheet (P5-12): the agency's sheet rules, each role's sheet, and each person's day.

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "sheet_template_id" UUID;

-- CreateTable
CREATE TABLE "sheet_settings" (
    "agency_id" UUID NOT NULL,
    "rule" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "sheet_templates" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "counters" JSONB NOT NULL DEFAULT '[]',
    "task_hint" TEXT NOT NULL DEFAULT '',
    "signers" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sheets" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "template_id" UUID NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "counters" JSONB NOT NULL DEFAULT '{}',
    "other_works" TEXT NOT NULL DEFAULT '',
    "day_reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "submitted_at" TIMESTAMP(3),
    "late" BOOLEAN NOT NULL DEFAULT false,
    "signatures" JSONB NOT NULL DEFAULT '[]',
    "return_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sheet_templates_agency_id_name_key" ON "sheet_templates"("agency_id", "name");

-- CreateIndex
CREATE INDEX "daily_sheets_agency_id_date_idx" ON "daily_sheets"("agency_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sheets_agency_id_user_id_date_key" ON "daily_sheets"("agency_id", "user_id", "date");


-- Row-level security.
ALTER TABLE "sheet_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sheet_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sheet_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "sheet_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sheet_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sheet_templates" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "daily_sheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_sheets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "daily_sheets" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "sheet_settings", "sheet_templates", "daily_sheets" TO genie_app;
  END IF;
END
$$;
