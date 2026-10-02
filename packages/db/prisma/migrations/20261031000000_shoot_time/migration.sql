-- Time spent on shoots (P2-13).

-- CreateTable
CREATE TABLE "shoot_time_logs" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "shoot_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shoot_time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shoot_time_logs_agency_id_shoot_id_idx" ON "shoot_time_logs"("agency_id", "shoot_id");

-- CreateIndex
CREATE INDEX "shoot_time_logs_agency_id_user_id_date_idx" ON "shoot_time_logs"("agency_id", "user_id", "date");

-- AddForeignKey
ALTER TABLE "shoot_time_logs" ADD CONSTRAINT "shoot_time_logs_shoot_id_fkey" FOREIGN KEY ("shoot_id") REFERENCES "shoots"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "shoot_time_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shoot_time_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "shoot_time_logs" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "shoot_time_logs" TO genie_app;
  END IF;
END
$$;
