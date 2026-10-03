-- Support inbox (P6-15): conversations between an agency and the platform's support team.
-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "page" TEXT,
    "created_by" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "from_platform" BOOLEAN NOT NULL DEFAULT false,
    "author_id" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_tickets_agency_id_updated_at_idx" ON "support_tickets"("agency_id", "updated_at");

-- CreateIndex
CREATE INDEX "support_tickets_status_updated_at_idx" ON "support_tickets"("status", "updated_at");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "support_tickets" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
-- The platform console reads every agency's; its replies are written in the agency's own context.
CREATE POLICY platform_support_tickets ON "support_tickets" FOR SELECT USING (current_setting('app.platform', true) = 'on');

ALTER TABLE "support_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "support_messages" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY platform_support_messages ON "support_messages" FOR SELECT USING (current_setting('app.platform', true) = 'on');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "support_tickets", "support_messages" TO genie_app;
  END IF;
END
$$;
