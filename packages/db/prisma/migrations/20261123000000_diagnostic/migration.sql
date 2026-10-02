-- Business diagnostic (P5-18): BFA snapshots, the Strategic Road Map and saved scenarios.

-- CreateTable
CREATE TABLE "diagnostic_snapshots" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'review',
    "rows" JSONB NOT NULL,
    "challenges" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_map_items" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "function" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "start_month" TEXT NOT NULL,
    "end_month" TEXT NOT NULL,
    "owner_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "goal_id" UUID,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_map_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diagnostic_snapshots_agency_id_taken_at_idx" ON "diagnostic_snapshots"("agency_id", "taken_at");

-- CreateIndex
CREATE INDEX "road_map_items_agency_id_start_month_idx" ON "road_map_items"("agency_id", "start_month");


-- Row-level security.
ALTER TABLE "diagnostic_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnostic_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "diagnostic_snapshots" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "road_map_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "road_map_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "road_map_items" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scenarios" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scenarios" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "diagnostic_snapshots", "road_map_items", "scenarios" TO genie_app;
  END IF;
END
$$;
