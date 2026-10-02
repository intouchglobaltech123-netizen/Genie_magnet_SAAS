-- Goals (P5-13): the agency's goal rule and saved revenue cascade, goals from company to person, and check-ins.

-- CreateTable
CREATE TABLE "goal_settings" (
    "agency_id" UUID NOT NULL,
    "rule" JSONB NOT NULL,
    "cascade" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "parent_id" UUID,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID,
    "type" TEXT NOT NULL,
    "owner_ids" TEXT[],
    "measure" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target" DOUBLE PRECISION NOT NULL,
    "actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metric" TEXT,
    "start_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "cadence" TEXT NOT NULL,
    "smart" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_check_ins" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "by" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_agency_id_parent_id_idx" ON "goals"("agency_id", "parent_id");

-- CreateIndex
CREATE INDEX "goal_check_ins_agency_id_goal_id_idx" ON "goal_check_ins"("agency_id", "goal_id");

-- AddForeignKey
ALTER TABLE "goal_check_ins" ADD CONSTRAINT "goal_check_ins_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "goal_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "goal_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "goals" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "goal_check_ins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_check_ins" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "goal_check_ins" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "goal_settings", "goals", "goal_check_ins" TO genie_app;
  END IF;
END
$$;
