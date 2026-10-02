-- Monthly reports (P3-09) and the numbers for published posts.

-- CreateTable
CREATE TABLE "post_metrics" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "views" INTEGER,
    "reach" INTEGER,
    "likes" INTEGER,
    "comments" INTEGER,
    "shares" INTEGER,
    "saves" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT,

    CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_reports" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "data" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "released_by" TEXT,

    CONSTRAINT "monthly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_metrics_post_id_key" ON "post_metrics"("post_id");

-- CreateIndex
CREATE INDEX "monthly_reports_agency_id_month_idx" ON "monthly_reports"("agency_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_reports_agency_id_client_id_month_key" ON "monthly_reports"("agency_id", "client_id", "month");

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "scheduled_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Row-level security.
ALTER TABLE "post_metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "post_metrics" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "post_metrics" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "monthly_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_reports" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "monthly_reports" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "post_metrics", "monthly_reports" TO genie_app;
  END IF;
END
$$;
