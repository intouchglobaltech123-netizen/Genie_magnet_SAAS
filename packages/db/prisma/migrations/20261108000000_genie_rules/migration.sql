-- Genie Assistant rules and insights (P4-01, P4-02). The placeholder insights table from the first schema was never
-- used; it is replaced.
DROP TABLE "insights";
DROP TYPE "InsightStatus";

-- CreateTable
CREATE TABLE "genie_settings" (
    "agency_id" UUID NOT NULL,
    "rules" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genie_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "area" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "client_id" UUID,
    "link" TEXT,
    "owner_id" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'open',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "insights_agency_id_status_idx" ON "insights"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "insights_agency_id_dedupe_key_key" ON "insights"("agency_id", "dedupe_key");

-- Row-level security.
ALTER TABLE "genie_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "genie_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "genie_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "insights" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "genie_settings", "insights" TO genie_app;
  END IF;
END
$$;
