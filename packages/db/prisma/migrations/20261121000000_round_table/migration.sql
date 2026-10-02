-- Round Table (P5-15): peer reviews in timed rounds, moderated and released.

-- CreateTable
CREATE TABLE "rt_sessions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "meeting_id" UUID,
    "facilitator_id" TEXT,
    "participant_ids" TEXT[],
    "questions" TEXT[],
    "seconds_per_person" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_index" INTEGER NOT NULL DEFAULT 0,
    "round_ends_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rt_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rt_answers" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "subject_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "answers" TEXT[],
    "missed" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "hidden_reason" TEXT,
    "commitment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rt_sessions_agency_id_created_at_idx" ON "rt_sessions"("agency_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rt_answers_session_id_subject_id_author_id_key" ON "rt_answers"("session_id", "subject_id", "author_id");

-- AddForeignKey
ALTER TABLE "rt_answers" ADD CONSTRAINT "rt_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "rt_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "rt_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rt_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rt_sessions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "rt_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rt_answers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rt_answers" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "rt_sessions", "rt_answers" TO genie_app;
  END IF;
END
$$;
