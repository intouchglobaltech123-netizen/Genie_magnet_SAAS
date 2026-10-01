-- Proposals with discount approval (P1-16) and the agency's discount limit.

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "discount_limit" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "package_id" UUID,
    "package_name" TEXT NOT NULL,
    "list_fee" INTEGER NOT NULL,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "monthly_fee" INTEGER NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 12,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" TEXT NOT NULL,
    "decision_note" TEXT,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_agency_id_lead_id_idx" ON "proposals"("agency_id", "lead_id");
CREATE INDEX "proposals_agency_id_status_idx" ON "proposals"("agency_id", "status");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row-level security.
ALTER TABLE "proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proposals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "proposals" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "proposals" TO genie_app;
  END IF;
END
$$;
