-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('starter', 'growth', 'pro', 'internal');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'manager', 'creative', 'sales', 'finance', 'hr', 'freelancer', 'client');

-- CreateEnum
CREATE TYPE "BusinessStage" AS ENUM ('struggle', 'survival', 'stability', 'success', 'scale');

-- CreateEnum
CREATE TYPE "Fitment" AS ENUM ('amazing', 'bread_winning', 'convenience', 'dangerous');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'qualified', 'discovery', 'proposal', 'negotiation', 'won', 'lost');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('draft', 'active', 'renewal_due', 'paused', 'ended');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('upcoming', 'in_progress', 'reconciling', 'closed');

-- CreateEnum
CREATE TYPE "QuestionnaireKind" AS ENUM ('client', 'agency');

-- CreateEnum
CREATE TYPE "ContentStage" AS ENUM ('idea', 'topic', 'research', 'script', 'approval', 'ready');

-- CreateEnum
CREATE TYPE "VideoStage" AS ENUM ('planned', 'scripting', 'shoot_scheduled', 'shot', 'editing', 'internal_qc', 'client_review', 'revision', 'approved', 'published');

-- CreateEnum
CREATE TYPE "RevisionKind" AS ENUM ('agency_correction', 'included_revision', 'change_request');

-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('open', 'approved', 'edited', 'dismissed');

-- CreateEnum
CREATE TYPE "ReviewCadence" AS ENUM ('daily', 'weekly', 'tactical', 'strategic');

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'starter',
    "window_days" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "source" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'new',
    "value" INTEGER NOT NULL DEFAULT 0,
    "owner_id" TEXT,
    "next_follow_up" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "city" TEXT,
    "stage" "BusinessStage",
    "fitment" "Fitment",
    "health" INTEGER,
    "whatsapp_group_url" TEXT,
    "account_owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "approver" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "monthly_fee" INTEGER NOT NULL,
    "videos_per_month" INTEGER NOT NULL,
    "posts_per_month" INTEGER NOT NULL,
    "shoot_days" INTEGER NOT NULL,
    "revisions_per_deliverable" INTEGER NOT NULL,
    "platforms" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreements" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "package_id" UUID,
    "title" TEXT NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'draft',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "monthly_fee" INTEGER NOT NULL,
    "billing" TEXT NOT NULL,
    "revisions_per_deliverable" INTEGER NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'upcoming',
    "promised" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_templates" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "kind" "QuestionnaireKind" NOT NULL,
    "version" TEXT NOT NULL,
    "window_days" INTEGER NOT NULL DEFAULT 7,
    "definition" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "questionnaire_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_responses" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "client_id" UUID,
    "token" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'link',
    "sent_at" TIMESTAMP(3),
    "required_done_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "question_key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "answered_by" TEXT,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionnaire_reminders" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "response_id" UUID NOT NULL,
    "day" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionnaire_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_lists" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "needed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "topic_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "pillar" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "stage" "ContentStage" NOT NULL DEFAULT 'idea',
    "owner_id" TEXT,
    "month" DATE NOT NULL,
    "due" DATE,
    "pick" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_versions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "content_item_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "on_screen" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "client_note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "cycle_id" UUID,
    "content_item_id" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "aspect" TEXT NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'standard',
    "stage" "VideoStage" NOT NULL DEFAULT 'planned',
    "editor_id" TEXT,
    "due_date" DATE,
    "publish_date" DATE,
    "revisions_used" INTEGER NOT NULL DEFAULT 0,
    "edit_steps" JSONB NOT NULL DEFAULT '{}',
    "qc" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_versions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "duration" TEXT,
    "notes" TEXT,
    "file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "author" TEXT NOT NULL,
    "timestamp_sec" INTEGER,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "kind" "RevisionKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "estimate" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_connections" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "token_ref" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_posts" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "published_url" TEXT,
    "published_at" TIMESTAMP(3),
    "proof_file_id" UUID,

    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID,
    "to_phone" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "related_type" TEXT,
    "related_id" TEXT,
    "reply" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insights" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "draft" JSONB,
    "status" "InsightStatus" NOT NULL DEFAULT 'open',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "cadence" "ReviewCadence" NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "owner_id" TEXT,
    "due" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "mark" TEXT,
    "carried" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_agency_id_user_id_key" ON "memberships"("agency_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_agency_id_entity_entity_id_idx" ON "audit_logs"("agency_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_agency_id_at_idx" ON "audit_logs"("agency_id", "at");

-- CreateIndex
CREATE UNIQUE INDEX "files_agency_id_storage_key_key" ON "files"("agency_id", "storage_key");

-- CreateIndex
CREATE INDEX "leads_agency_id_stage_idx" ON "leads"("agency_id", "stage");

-- CreateIndex
CREATE INDEX "clients_agency_id_fitment_idx" ON "clients"("agency_id", "fitment");

-- CreateIndex
CREATE UNIQUE INDEX "clients_agency_id_code_key" ON "clients"("agency_id", "code");

-- CreateIndex
CREATE INDEX "contacts_agency_id_client_id_idx" ON "contacts"("agency_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "packages_agency_id_name_key" ON "packages"("agency_id", "name");

-- CreateIndex
CREATE INDEX "agreements_agency_id_client_id_idx" ON "agreements"("agency_id", "client_id");

-- CreateIndex
CREATE INDEX "agreements_agency_id_status_idx" ON "agreements"("agency_id", "status");

-- CreateIndex
CREATE INDEX "cycles_agency_id_status_idx" ON "cycles"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_agreement_id_month_key" ON "cycles"("agreement_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_templates_agency_id_kind_version_key" ON "questionnaire_templates"("agency_id", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_responses_token_key" ON "questionnaire_responses"("token");

-- CreateIndex
CREATE INDEX "questionnaire_responses_agency_id_client_id_idx" ON "questionnaire_responses"("agency_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_response_id_question_key_key" ON "answers"("response_id", "question_key");

-- CreateIndex
CREATE INDEX "questionnaire_reminders_agency_id_response_id_idx" ON "questionnaire_reminders"("agency_id", "response_id");

-- CreateIndex
CREATE INDEX "topic_lists_agency_id_status_idx" ON "topic_lists"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "topic_lists_client_id_month_key" ON "topic_lists"("client_id", "month");

-- CreateIndex
CREATE INDEX "content_items_agency_id_client_id_month_idx" ON "content_items"("agency_id", "client_id", "month");

-- CreateIndex
CREATE INDEX "content_items_agency_id_stage_idx" ON "content_items"("agency_id", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "script_versions_content_item_id_number_key" ON "script_versions"("content_item_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "videos_content_item_id_key" ON "videos"("content_item_id");

-- CreateIndex
CREATE INDEX "videos_agency_id_stage_idx" ON "videos"("agency_id", "stage");

-- CreateIndex
CREATE INDEX "videos_agency_id_client_id_due_date_idx" ON "videos"("agency_id", "client_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "videos_agency_id_code_key" ON "videos"("agency_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "video_versions_video_id_label_key" ON "video_versions"("video_id", "label");

-- CreateIndex
CREATE INDEX "review_comments_agency_id_version_id_idx" ON "review_comments"("agency_id", "version_id");

-- CreateIndex
CREATE INDEX "change_requests_agency_id_status_idx" ON "change_requests"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_client_id_platform_key" ON "platform_connections"("client_id", "platform");

-- CreateIndex
CREATE INDEX "scheduled_posts_agency_id_scheduled_at_idx" ON "scheduled_posts"("agency_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "whatsapp_messages_agency_id_client_id_sent_at_idx" ON "whatsapp_messages"("agency_id", "client_id", "sent_at");

-- CreateIndex
CREATE INDEX "insights_agency_id_status_idx" ON "insights"("agency_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "insights_agency_id_dedupe_key_key" ON "insights"("agency_id", "dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_agency_id_cadence_number_key" ON "meetings"("agency_id", "cadence", "number");

-- CreateIndex
CREATE INDEX "commitments_agency_id_status_idx" ON "commitments"("agency_id", "status");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "questionnaire_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_responses" ADD CONSTRAINT "questionnaire_responses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "questionnaire_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionnaire_reminders" ADD CONSTRAINT "questionnaire_reminders_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "questionnaire_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_versions" ADD CONSTRAINT "video_versions_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "video_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "platform_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

