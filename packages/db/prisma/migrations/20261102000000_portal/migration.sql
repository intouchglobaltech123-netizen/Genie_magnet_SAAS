-- The client portal (P3-01 to P3-05): private links per client contact, and requests clients raise.

-- CreateTable
CREATE TABLE "portal_links" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "portal_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_requests" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "contact_id" UUID,
    "contact_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "answer" TEXT,
    "answered_by" TEXT,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_links_contact_id_key" ON "portal_links"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_links_token_key" ON "portal_links"("token");

-- CreateIndex
CREATE INDEX "portal_links_agency_id_client_id_idx" ON "portal_links"("agency_id", "client_id");

-- CreateIndex
CREATE INDEX "client_requests_agency_id_client_id_status_idx" ON "client_requests"("agency_id", "client_id", "status");

-- CreateIndex
CREATE INDEX "client_requests_agency_id_status_created_at_idx" ON "client_requests"("agency_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "portal_links" ADD CONSTRAINT "portal_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Row-level security. A portal link is found by its token's hash without knowing the agency (policy portal_access,
-- like link_access for onboarding); everything after that runs inside the link's agency, limited to its client.
ALTER TABLE "portal_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "portal_links" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY portal_access ON "portal_links" FOR SELECT USING ("token" = current_setting('app.portal_token', true));

ALTER TABLE "client_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "client_requests" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "portal_links", "client_requests" TO genie_app;
  END IF;
END
$$;
