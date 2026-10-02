-- Performance and learning (P5-11): who people report to, KRA templates, month scorecards, A-C ratings, learning paths and the skill matrix.

-- AlterTable
ALTER TABLE "employee_profiles" ADD COLUMN     "kra_template_id" UUID,
ADD COLUMN     "manager_id" TEXT;

-- CreateTable
CREATE TABLE "performance_settings" (
    "agency_id" UUID NOT NULL,
    "rule" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "kra_templates" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kras" JSONB NOT NULL,
    "gate" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kra_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_scorecards" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "kras" JSONB NOT NULL,
    "gate" JSONB,
    "raw" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "gated" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewer_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "reply" TEXT,
    "shared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "month_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_ratings" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "ratings" JSONB NOT NULL,
    "player" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "rated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "for_role" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "owner_id" TEXT,
    "modules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_assignments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "path_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "done" TEXT[],
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "learning_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_levels" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "rated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kra_templates_agency_id_name_key" ON "kra_templates"("agency_id", "name");

-- CreateIndex
CREATE INDEX "month_scorecards_agency_id_month_idx" ON "month_scorecards"("agency_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "month_scorecards_agency_id_user_id_month_key" ON "month_scorecards"("agency_id", "user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "player_ratings_agency_id_user_id_month_key" ON "player_ratings"("agency_id", "user_id", "month");

-- CreateIndex
CREATE INDEX "learning_assignments_agency_id_user_id_idx" ON "learning_assignments"("agency_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_assignments_path_id_user_id_key" ON "learning_assignments"("path_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_agency_id_name_key" ON "skills"("agency_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "skill_levels_skill_id_user_id_key" ON "skill_levels"("skill_id", "user_id");

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_levels" ADD CONSTRAINT "skill_levels_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "performance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "performance_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "performance_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "kra_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kra_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "kra_templates" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "month_scorecards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "month_scorecards" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "month_scorecards" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "player_ratings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "player_ratings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "player_ratings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "learning_paths" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning_paths" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learning_paths" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "learning_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "learning_assignments" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skills" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "skills" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "skill_levels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "skill_levels" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "skill_levels" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "performance_settings", "kra_templates", "month_scorecards", "player_ratings", "learning_paths", "learning_assignments", "skills", "skill_levels" TO genie_app;
  END IF;
END
$$;
