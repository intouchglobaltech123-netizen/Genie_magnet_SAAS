-- Ask Genie conversations (P4-08).

-- CreateTable
CREATE TABLE "ask_conversations" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ask_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ask_messages" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ask_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ask_conversations_agency_id_user_id_updated_at_idx" ON "ask_conversations"("agency_id", "user_id", "updated_at");

-- CreateIndex
CREATE INDEX "ask_messages_agency_id_conversation_id_idx" ON "ask_messages"("agency_id", "conversation_id");

-- AddForeignKey
ALTER TABLE "ask_messages" ADD CONSTRAINT "ask_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ask_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security.
ALTER TABLE "ask_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ask_conversations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ask_conversations" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "ask_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ask_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ask_messages" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "ask_conversations", "ask_messages" TO genie_app;
  END IF;
END
$$;
