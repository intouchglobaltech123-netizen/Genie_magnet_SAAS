-- SOPs and checklists (P5-17): SOPs with versions approved before use, and checked runs of their checklists.

-- CreateTable
CREATE TABLE "sops" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID,
    "owner_id" TEXT,
    "pss_ref" TEXT NOT NULL DEFAULT '',
    "kra_template_id" UUID,
    "kra_key" TEXT,
    "doer_ids" TEXT[],
    "checker_id" TEXT,
    "approver_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_versions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "sop_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "purpose" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "change_note" TEXT NOT NULL DEFAULT '',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sop_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_runs" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "sop_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "by" TEXT NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "checked_by" TEXT,
    "checked_at" TIMESTAMP(3),
    "check_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sop_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sops_agency_id_active_idx" ON "sops"("agency_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "sop_versions_sop_id_number_key" ON "sop_versions"("sop_id", "number");

-- CreateIndex
CREATE INDEX "sop_runs_agency_id_status_idx" ON "sop_runs"("agency_id", "status");

-- CreateIndex
CREATE INDEX "sop_runs_agency_id_by_created_at_idx" ON "sop_runs"("agency_id", "by", "created_at");

-- AddForeignKey
ALTER TABLE "sop_versions" ADD CONSTRAINT "sop_versions_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "sops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_runs" ADD CONSTRAINT "sop_runs_sop_id_fkey" FOREIGN KEY ("sop_id") REFERENCES "sops"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "sops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sops" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sops" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "sop_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sop_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sop_versions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "sop_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sop_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sop_runs" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "sops", "sop_versions", "sop_runs" TO genie_app;
  END IF;
END
$$;
