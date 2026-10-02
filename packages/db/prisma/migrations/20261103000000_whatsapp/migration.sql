-- WhatsApp (P3-06, P3-07): each agency's own number with its secrets encrypted, its templates, the message log, and
-- each contact's opt-in. The whatsapp_messages table from the first schema was never used; it is cleared and reshaped.
DELETE FROM "whatsapp_messages";

-- DropIndex
DROP INDEX "whatsapp_messages_agency_id_client_id_sent_at_idx";

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "whatsapp_opt_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_opt_in_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_opt_in_source" TEXT;

-- AlterTable
ALTER TABLE "portal_links" ADD COLUMN     "token_secret" TEXT;

-- AlterTable
ALTER TABLE "questionnaire_responses" ADD COLUMN     "token_secret" TEXT;

-- AlterTable
ALTER TABLE "whatsapp_messages" DROP COLUMN "reply",
DROP COLUMN "to_phone",
DROP COLUMN "variables",
ADD COLUMN     "body" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "contact_id" UUID,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "direction" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "provider_id" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL,
ADD COLUMN     "read_at" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ALTER COLUMN "template" DROP NOT NULL,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "sent_at" DROP NOT NULL,
ALTER COLUMN "sent_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "whatsapp_connections" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "business_id" TEXT,
    "display_phone" TEXT,
    "verified_name" TEXT,
    "access_token" TEXT NOT NULL,
    "token_hint" TEXT NOT NULL,
    "app_secret" TEXT,
    "verify_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unchecked',
    "last_error" TEXT,
    "checked_at" TIMESTAMP(3),
    "quiet_from" TEXT NOT NULL DEFAULT '21:00',
    "quiet_to" TEXT NOT NULL DEFAULT '08:00',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_agency_id_key" ON "whatsapp_connections"("agency_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_agency_id_purpose_key" ON "whatsapp_templates"("agency_id", "purpose");

-- CreateIndex
CREATE INDEX "whatsapp_messages_agency_id_client_id_created_at_idx" ON "whatsapp_messages"("agency_id", "client_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_agency_id_contact_id_created_at_idx" ON "whatsapp_messages"("agency_id", "contact_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_agency_id_status_created_at_idx" ON "whatsapp_messages"("agency_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_messages_agency_id_provider_id_key" ON "whatsapp_messages"("agency_id", "provider_id");



-- Row-level security. WhatsApp's notices arrive at an address with the connection's id; a transaction that sets
-- app.whatsapp_connection to that id can read that one connection (policy webhook_access) to find its agency, and
-- nothing else. whatsapp_messages already has its policy from the first schema.
ALTER TABLE "whatsapp_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_connections" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY webhook_access ON "whatsapp_connections" FOR SELECT USING ("id"::text = current_setting('app.whatsapp_connection', true));

ALTER TABLE "whatsapp_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "whatsapp_templates" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "whatsapp_connections", "whatsapp_templates", "whatsapp_messages" TO genie_app;
  END IF;
END
$$;
