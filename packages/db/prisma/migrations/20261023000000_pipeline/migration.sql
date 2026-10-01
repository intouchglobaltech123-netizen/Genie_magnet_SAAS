-- Sales pipeline (P1-14) and activities (P1-15). Lead stages become the agency's own stages (by key).

-- Leads: the stage is a key of the agency's pipeline stages (kept as it is: new, contacted, ... won, lost).
ALTER TABLE "leads" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "stage" TYPE TEXT USING "stage"::text;
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'new';
DROP TYPE "LeadStage";

ALTER TABLE "leads" ADD COLUMN     "client_id" UUID,
ADD COLUMN     "lost_reason" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "leads_agency_id_owner_id_idx" ON "leads"("agency_id", "owner_id");

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'open',
    "probability" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "outcome" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pipeline_stages_agency_id_key_key" ON "pipeline_stages"("agency_id", "key");
CREATE INDEX "activities_agency_id_lead_id_at_idx" ON "activities"("agency_id", "lead_id", "at");

ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security.
ALTER TABLE "pipeline_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pipeline_stages" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "activities" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "pipeline_stages", "activities" TO genie_app;
  END IF;
END
$$;
