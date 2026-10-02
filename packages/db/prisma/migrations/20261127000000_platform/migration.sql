-- Plans and the platform (P6-01 to P6-03): the platform's settings and each agency's subscription.

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "agency_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "grace_until" TIMESTAMP(3),
    "provider" TEXT NOT NULL DEFAULT 'outbox',
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("agency_id")
);


-- Row-level security (ADR 0011). The platform's own transactions set app.platform, which reveals the platform settings,
-- every agency's subscription and the list of agencies - nothing else. Anyone may read the platform settings (the
-- plans are what the pricing page shows); only the platform changes them.
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY read_all ON "platform_settings" FOR SELECT USING (true);
CREATE POLICY platform_only ON "platform_settings" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');

ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscriptions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY platform_subscriptions ON "subscriptions" USING (current_setting('app.platform', true) = 'on') WITH CHECK (current_setting('app.platform', true) = 'on');

CREATE POLICY platform_agencies ON "agencies" FOR SELECT USING (current_setting('app.platform', true) = 'on');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_settings", "subscriptions" TO genie_app;
  END IF;
END
$$;
