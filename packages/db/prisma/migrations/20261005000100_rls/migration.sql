-- Row-level security: every tenant table is visible only inside its agency.
-- The API/worker set app.agency_id per transaction (packages/db/src/tenancy.ts).
-- FORCE makes the policies apply to the table owner too; only superusers bypass them.

CREATE OR REPLACE FUNCTION app_current_agency() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.agency_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_current_user() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.user_id', true), '') $$;

-- agencies: an agency sees only itself.
ALTER TABLE "agencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agencies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agencies" USING ("id" = app_current_agency()) WITH CHECK ("id" = app_current_agency());

-- memberships: visible inside the agency, and a signed-in user can list their own memberships (agency switcher).
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "memberships" USING ("agency_id" = app_current_agency() OR "user_id" = app_current_user()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "audit_logs" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "files" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leads" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leads" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "clients" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "contacts" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "packages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "packages" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "agreements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agreements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agreements" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cycles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "cycles" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "questionnaire_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questionnaire_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "questionnaire_templates" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "questionnaire_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questionnaire_responses" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "questionnaire_responses" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "answers" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "questionnaire_reminders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questionnaire_reminders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "questionnaire_reminders" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "topic_lists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "topic_lists" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "topic_lists" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "content_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "content_items" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "script_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "script_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "script_versions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "videos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "videos" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "videos" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "video_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "video_versions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "review_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_comments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "review_comments" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "change_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "change_requests" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "platform_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "platform_connections" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "scheduled_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_posts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scheduled_posts" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "whatsapp_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_messages" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "insights" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "insights" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "meetings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "meetings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "commitments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commitments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "commitments" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

-- Runtime role: read/write data, never schema changes, never the migrations table.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT USAGE ON SCHEMA public TO genie_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO genie_app;
    IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
      REVOKE ALL ON "_prisma_migrations" FROM genie_app;
    END IF;
    -- The audit log is append-only for the application.
    REVOKE UPDATE, DELETE ON "audit_logs" FROM genie_app;
    GRANT EXECUTE ON FUNCTION app_current_agency(), app_current_user() TO genie_app;
  END IF;
END
$$;
