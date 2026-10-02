-- Background jobs in PostgreSQL (ADR 0010).

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "last_error" TEXT,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_status_run_at_idx" ON "jobs"("status", "run_at");

-- CreateIndex
CREATE INDEX "jobs_agency_id_status_created_at_idx" ON "jobs"("agency_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_agency_id_key_key" ON "jobs"("agency_id", "key");


-- Row-level security: inside an agency as usual. The job runner claims work across agencies by setting
-- app.job_runner for its own short transactions (claimJobs, scheduleJobs in @gm/db); that setting reveals the jobs
-- table and the list of agencies, nothing else. Each job then runs inside its own agency.
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "jobs" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY job_runner ON "jobs" USING (current_setting('app.job_runner', true) = 'on') WITH CHECK (current_setting('app.job_runner', true) = 'on');
CREATE POLICY job_runner_agencies ON "agencies" FOR SELECT USING (current_setting('app.job_runner', true) = 'on');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "jobs" TO genie_app;
  END IF;
END
$$;
