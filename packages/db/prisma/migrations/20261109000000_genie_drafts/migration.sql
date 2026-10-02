-- Genie Assistant drafts and AI usage (P4-05, P4-06, P4-09, P4-10).

-- AlterTable
ALTER TABLE "genie_settings" ADD COLUMN "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "monthly_budget" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN "retention_days" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "drafts" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "client_id" UUID,
    "request" JSONB NOT NULL DEFAULT '{}',
    "context" TEXT,
    "output" JSONB NOT NULL,
    "final" JSONB,
    "edited_pct" INTEGER,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "user_id" TEXT,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_paise" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "drafts_agency_id_entity_entity_id_idx" ON "drafts"("agency_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "drafts_agency_id_kind_status_idx" ON "drafts"("agency_id", "kind", "status");

-- CreateIndex
CREATE INDEX "ai_usage_agency_id_created_at_idx" ON "ai_usage"("agency_id", "created_at");

-- Row-level security.
ALTER TABLE "drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drafts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "drafts" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_usage" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "drafts", "ai_usage" TO genie_app;
  END IF;
END
$$;
