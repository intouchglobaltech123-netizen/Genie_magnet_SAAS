-- The production pipeline (Phase 2): cycles, content, videos with stages, editing, QC, versions, revisions, shoots,
-- publishing, and each agency's production settings.

-- AlterTable
ALTER TABLE "change_requests" ADD COLUMN     "client_id" UUID,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "date_impact_days" INTEGER,
ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "version_id" UUID,
ALTER COLUMN "video_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "pillars" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "research" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "cycles" ADD COLUMN     "carried_in" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "closed_by" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "credit" INTEGER,
ADD COLUMN     "decision" TEXT,
ADD COLUMN     "decision_note" TEXT;

-- AlterTable
ALTER TABLE "review_comments" ADD COLUMN     "created_by" TEXT;

-- AlterTable
ALTER TABLE "scheduled_posts" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "published_by" TEXT;

-- AlterTable
ALTER TABLE "script_versions" ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "decided_by" TEXT,
ADD COLUMN     "sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "topic_lists" ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT;

-- AlterTable
ALTER TABLE "video_versions" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "link" TEXT,
ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sent_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "agreement_id" UUID,
ADD COLUMN     "camera_id" TEXT,
ADD COLUMN     "clip_no" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "delay_reason" TEXT,
ADD COLUMN     "director_id" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "planned_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "protected_at" TIMESTAMP(3),
ADD COLUMN     "protected_by" TEXT,
ADD COLUMN     "shoot_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "production_settings" (
    "agency_id" UUID NOT NULL,
    "video_code_format" TEXT NOT NULL,
    "formats" JSONB NOT NULL,
    "edit_steps" JSONB NOT NULL,
    "qc_checks" JSONB NOT NULL,
    "kits" JSONB NOT NULL,
    "pre_shoot" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "video_stage_changes" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "from" "VideoStage",
    "to" "VideoStage" NOT NULL,
    "note" TEXT,
    "by" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_stage_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_time_logs" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoots" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "call_time" TEXT,
    "location" TEXT,
    "batch_no" TEXT,
    "kit" TEXT NOT NULL,
    "camera_id" TEXT,
    "director_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "kit_ticks" JSONB NOT NULL DEFAULT '{}',
    "pre_shoot" JSONB NOT NULL DEFAULT '{}',
    "signatures" JSONB NOT NULL DEFAULT '{}',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shoots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shoot_incidents" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "shoot_id" UUID NOT NULL,
    "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shoot_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "video_stage_changes_agency_id_video_id_idx" ON "video_stage_changes"("agency_id", "video_id");

-- CreateIndex
CREATE INDEX "video_time_logs_agency_id_video_id_idx" ON "video_time_logs"("agency_id", "video_id");

-- CreateIndex
CREATE INDEX "video_time_logs_agency_id_user_id_date_idx" ON "video_time_logs"("agency_id", "user_id", "date");

-- CreateIndex
CREATE INDEX "shoots_agency_id_date_idx" ON "shoots"("agency_id", "date");

-- CreateIndex
CREATE INDEX "shoot_incidents_agency_id_shoot_id_idx" ON "shoot_incidents"("agency_id", "shoot_id");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_stage_changes" ADD CONSTRAINT "video_stage_changes_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_time_logs" ADD CONSTRAINT "video_time_logs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shoot_incidents" ADD CONSTRAINT "shoot_incidents_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoots"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security for the new tables.
ALTER TABLE "production_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "production_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "video_stage_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_stage_changes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "video_stage_changes" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "video_time_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "video_time_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "video_time_logs" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "shoots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shoots" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shoots" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "shoot_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shoot_incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shoot_incidents" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "production_settings", "video_stage_changes", "video_time_logs", "shoots", "shoot_incidents" TO genie_app;
  END IF;
END
$$;
