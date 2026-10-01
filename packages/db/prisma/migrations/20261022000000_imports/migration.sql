-- Spreadsheet imports (P1-31): history and undo. The file is read in the browser and never stored.

-- CreateTable
CREATE TABLE "imports" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created_ids" TEXT[],
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undone_at" TIMESTAMP(3),
    "undone_by" TEXT,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "imports_agency_id_created_at_idx" ON "imports"("agency_id", "created_at");

-- Row-level security: an agency sees only its own imports.
ALTER TABLE "imports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "imports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "imports" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE ON "imports" TO genie_app;
  END IF;
END
$$;
