-- Sample data (P6-06): what an agency added to try things with, so it can all be removed in one go.
-- CreateTable
CREATE TABLE "sample_data" (
    "agency_id" UUID NOT NULL,
    "client_ids" TEXT[],
    "lead_ids" TEXT[],
    "video_ids" TEXT[],
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),
    "removed_by" TEXT,

    CONSTRAINT "sample_data_pkey" PRIMARY KEY ("agency_id")
);


ALTER TABLE "sample_data" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sample_data" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sample_data" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

-- Deletes rows of a table by id, with everything that points at them through a foreign key that would stop the
-- delete or cascade from it, depth first. Used only by app_remove_sample below; row-level security still limits it
-- to the agency set on the connection.
CREATE OR REPLACE FUNCTION app_delete_records(target regclass, ids text[], depth integer DEFAULT 0) RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  r record;
  child_ids text[];
  n integer;
BEGIN
  IF ids IS NULL OR cardinality(ids) = 0 THEN
    RETURN 0;
  END IF;
  IF depth > 12 THEN
    RAISE EXCEPTION 'records nested too deeply under %', target;
  END IF;
  FOR r IN
    SELECT c.conrelid::regclass AS child, a.attname::text AS col,
      EXISTS (SELECT 1 FROM pg_attribute i WHERE i.attrelid = c.conrelid AND i.attname = 'id' AND NOT i.attisdropped) AS has_id
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.contype = 'f' AND c.confrelid = target AND cardinality(c.conkey) = 1 AND c.confdeltype IN ('a', 'r', 'c')
  LOOP
    IF r.has_id THEN
      EXECUTE format('SELECT array_agg(id::text) FROM %s WHERE %I::text = ANY($1)', r.child, r.col) INTO child_ids USING ids;
      PERFORM app_delete_records(r.child, child_ids, depth + 1);
    ELSE
      EXECUTE format('DELETE FROM %s WHERE %I::text = ANY($1)', r.child, r.col) USING ids;
    END IF;
  END LOOP;
  EXECUTE format('DELETE FROM %s WHERE id::text = ANY($1)', target) USING ids;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;
REVOKE ALL ON FUNCTION app_delete_records(regclass, text[], integer) FROM PUBLIC;

-- Removes the agency's sample data (P6-06): the sample clients with everything made for them since (contacts,
-- agreements, videos, shoots, topics, portal links, messages and the rest), and the sample leads and videos. A sample
-- client with an issued invoice is kept, with its invoices, which stay for the agency's GST records. It runs as the
-- database owner, so history the API's own role may not delete goes too; but only for the agency set on the
-- connection (row-level security still applies) and only for the records its sample_data row lists.
-- Returns the codes of the sample clients kept.
CREATE OR REPLACE FUNCTION app_remove_sample() RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  agency uuid := app_current_agency();
  s record;
  gone text[];
  kept text[];
  t record;
BEGIN
  IF agency IS NULL THEN
    RAISE EXCEPTION 'no agency set';
  END IF;
  SELECT * INTO s FROM sample_data WHERE agency_id = agency AND removed_at IS NULL;
  IF NOT FOUND THEN
    RETURN ARRAY[]::text[];
  END IF;
  SELECT
    array_agg(c.id::text) FILTER (WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = c.id AND i.number IS NOT NULL)),
    array_agg(c.code) FILTER (WHERE EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = c.id AND i.number IS NOT NULL))
  INTO gone, kept
  FROM clients c
  WHERE c.id::text = ANY(s.client_ids);
  IF gone IS NOT NULL THEN
    -- Records that name a client without a foreign key (portal links, messages, requests, reports) go too.
    FOR t IN
      SELECT c.table_name::text AS name,
        EXISTS (SELECT 1 FROM information_schema.columns i WHERE i.table_schema = 'public' AND i.table_name = c.table_name AND i.column_name = 'id') AS has_id
      FROM information_schema.columns c
      JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
      WHERE c.table_schema = 'public' AND c.column_name = 'client_id' AND tb.table_type = 'BASE TABLE' AND c.table_name <> 'clients'
      ORDER BY c.table_name
    LOOP
      IF t.has_id THEN
        EXECUTE format('SELECT app_delete_records(%L::regclass, ARRAY(SELECT id::text FROM %I WHERE client_id::text = ANY($1)))', t.name, t.name) USING gone;
      ELSE
        EXECUTE format('DELETE FROM %I WHERE client_id::text = ANY($1)', t.name) USING gone;
      END IF;
    END LOOP;
  END IF;
  PERFORM app_delete_records('videos'::regclass, s.video_ids);
  PERFORM app_delete_records('leads'::regclass, s.lead_ids);
  PERFORM app_delete_records('clients'::regclass, gone);
  RETURN coalesce(kept, ARRAY[]::text[]);
END
$fn$;
REVOKE ALL ON FUNCTION app_remove_sample() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "sample_data" TO genie_app;
    GRANT EXECUTE ON FUNCTION app_remove_sample() TO genie_app;
  END IF;
END
$$;
