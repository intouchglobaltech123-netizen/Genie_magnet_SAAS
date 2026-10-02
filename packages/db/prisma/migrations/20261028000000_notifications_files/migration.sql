-- Notifications in the app (P1-04) and file storage (P1-05).

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "entity" TEXT,
ADD COLUMN     "entity_id" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "uploaded_at" TIMESTAMP(3),
ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "muted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quiet_from" TEXT,
    "quiet_to" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("agency_id","user_id")
);

-- CreateIndex
CREATE INDEX "notifications_agency_id_user_id_read_at_idx" ON "notifications"("agency_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_agency_id_user_id_created_at_idx" ON "notifications"("agency_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "files_agency_id_entity_entity_id_idx" ON "files"("agency_id", "entity", "entity_id");


-- Row-level security.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notifications" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "notification_preferences" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "notifications", "notification_preferences" TO genie_app;
  END IF;
END
$$;
