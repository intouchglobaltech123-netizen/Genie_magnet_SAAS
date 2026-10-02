-- Hiring (P5-10): the agency's hiring rule, openings, candidates, interviews and scorecards.

-- CreateTable
CREATE TABLE "hiring_settings" (
    "agency_id" UUID NOT NULL,
    "rule" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hiring_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateTable
CREATE TABLE "openings" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "department_id" UUID,
    "positions" INTEGER NOT NULL DEFAULT 1,
    "hiring_manager_id" TEXT,
    "budget_from" INTEGER,
    "budget_to" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "definition" TEXT NOT NULL DEFAULT '',
    "deliverables" TEXT[],
    "tasks" TEXT[],
    "competence" JSONB NOT NULL DEFAULT '{}',
    "star" JSONB NOT NULL DEFAULT '{}',
    "sources" TEXT[],
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "opening_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "source" TEXT,
    "experience" TEXT,
    "current_pay" INTEGER,
    "expected_pay" INTEGER,
    "notes" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "rejected_reason" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "offer" JSONB,
    "invitation_id" TEXT,
    "user_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "interviewer_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'in_person',
    "where" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_scorecards" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "interviewer_id" TEXT NOT NULL,
    "ratings" JSONB NOT NULL,
    "star" JSONB NOT NULL,
    "task_score" INTEGER NOT NULL,
    "remarks" TEXT NOT NULL DEFAULT '',
    "total" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "recommendation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "openings_agency_id_status_idx" ON "openings"("agency_id", "status");

-- CreateIndex
CREATE INDEX "candidates_agency_id_opening_id_stage_idx" ON "candidates"("agency_id", "opening_id", "stage");

-- CreateIndex
CREATE INDEX "candidates_invitation_id_idx" ON "candidates"("invitation_id");

-- CreateIndex
CREATE INDEX "interviews_agency_id_at_idx" ON "interviews"("agency_id", "at");

-- CreateIndex
CREATE INDEX "interviews_candidate_id_idx" ON "interviews"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "interview_scorecards_candidate_id_interviewer_id_key" ON "interview_scorecards"("candidate_id", "interviewer_id");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_opening_id_fkey" FOREIGN KEY ("opening_id") REFERENCES "openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "hiring_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hiring_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "hiring_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "openings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "openings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "openings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidates" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "candidates" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "interviews" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "interview_scorecards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interview_scorecards" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "interview_scorecards" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "hiring_settings", "openings", "candidates", "interviews", "interview_scorecards" TO genie_app;
  END IF;
END
$$;
