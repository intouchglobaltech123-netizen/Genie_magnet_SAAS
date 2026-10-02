-- Financial planner (P5-19): each person's own planner.

-- CreateTable
CREATE TABLE "personal_planners" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_planners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_planners_agency_id_user_id_key" ON "personal_planners"("agency_id", "user_id");


-- Row-level security.
ALTER TABLE "personal_planners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_planners" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "personal_planners" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "personal_planners" TO genie_app;
  END IF;
END
$$;
