-- Support access (P6-08): the agency's consent for the platform's support team to come in.

-- CreateTable
CREATE TABLE "support_grants" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'view',
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "granted_by" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_grants_agency_id_expires_at_idx" ON "support_grants"("agency_id", "expires_at");


-- Row-level security: the agency keeps its grants; the platform sees them, to know who may be visited, and marks a visit.
ALTER TABLE "support_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_grants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "support_grants" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY platform_grants ON "support_grants" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "support_grants" TO genie_app;
  END IF;
END
$$;
