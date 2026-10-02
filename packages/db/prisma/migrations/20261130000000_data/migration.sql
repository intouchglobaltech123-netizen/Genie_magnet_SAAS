-- The agency's own data (P6-10): full exports, and deleting the workspace after a grace period.

-- CreateTable
CREATE TABLE "data_exports" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "requested_by" TEXT NOT NULL,
    "storage_key" TEXT,
    "size" BIGINT,
    "tables" INTEGER,
    "rows" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ready_at" TIMESTAMP(3),

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_deletions" (
    "agency_id" UUID NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delete_after" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,

    CONSTRAINT "workspace_deletions_pkey" PRIMARY KEY ("agency_id")
);

-- CreateIndex
CREATE INDEX "data_exports_agency_id_created_at_idx" ON "data_exports"("agency_id", "created_at");


-- Row-level security: each agency keeps its own; the platform sees which workspaces are due to be deleted.
ALTER TABLE "data_exports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_exports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_exports" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "workspace_deletions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workspace_deletions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "workspace_deletions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY platform_deletions ON "workspace_deletions" FOR SELECT USING (current_setting('app.platform', true) = 'on');

-- Deleting a workspace (P6-10): every row the agency owns, then the agency itself. It runs as the database owner
-- (SECURITY DEFINER) so the audit log, which the API's own role can never change, goes too; but every table is still
-- read through its row-level security with the agency set, so nothing of another agency can be touched, and it refuses
-- unless that agency's deletion is due. Tables are tried again until those that others point at can go. Our own
-- invoices to the agency are kept: we must keep them.
CREATE OR REPLACE FUNCTION app_purge_agency(target uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  t record;
  pass integer := 0;
  left_over integer := 0;
BEGIN
  PERFORM set_config('app.agency_id', target::text, true);
  IF NOT EXISTS (SELECT 1 FROM workspace_deletions WHERE agency_id = target AND cancelled_at IS NULL AND delete_after <= now()) THEN
    RAISE EXCEPTION 'agency % is not due to be deleted', target;
  END IF;
  LOOP
    left_over := 0;
    pass := pass + 1;
    FOR t IN
      SELECT c.table_name::text AS name
      FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'agency_id' AND tb.table_type = 'BASE TABLE'
        AND c.table_name NOT IN ('platform_invoices', 'workspace_deletions')
      ORDER BY c.table_name
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM %I WHERE agency_id = $1', t.name) USING target;
      EXCEPTION WHEN foreign_key_violation THEN
        left_over := left_over + 1;
      END;
    END LOOP;
    EXIT WHEN left_over = 0 OR pass >= 25;
  END LOOP;
  IF left_over > 0 THEN
    RAISE EXCEPTION 'could not delete everything of agency %', target;
  END IF;
  DELETE FROM workspace_deletions WHERE agency_id = target;
  DELETE FROM agencies WHERE id = target;
  RETURN pass;
END
$fn$;
REVOKE ALL ON FUNCTION app_purge_agency(uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "data_exports", "workspace_deletions" TO genie_app;
    GRANT EXECUTE ON FUNCTION app_purge_agency(uuid) TO genie_app;
  END IF;
END
$$;
