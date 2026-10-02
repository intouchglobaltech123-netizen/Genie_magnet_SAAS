-- Equipment and assets (P5-20): the register, custody, reservations and maintenance.

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "serial_no" TEXT NOT NULL DEFAULT '',
    "purchase_date" DATE NOT NULL,
    "purchase_value" INTEGER NOT NULL,
    "residual_value" INTEGER NOT NULL DEFAULT 0,
    "useful_life_years" INTEGER NOT NULL,
    "hours_per_year" INTEGER,
    "condition" TEXT NOT NULL DEFAULT 'Good',
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "retired_at" TIMESTAMP(3),
    "retired_note" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_custody" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'out',
    "user_id" TEXT NOT NULL,
    "shoot_id" UUID,
    "purpose" TEXT NOT NULL DEFAULT '',
    "due_on" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "out_by" TEXT,
    "returned_at" TIMESTAMP(3),
    "returned_to" TEXT,
    "return_condition" TEXT,
    "minutes" INTEGER,
    "return_note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "asset_custody_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_reservations" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "user_id" TEXT NOT NULL,
    "shoot_id" UUID,
    "purpose" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_maintenance" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "by" TEXT NOT NULL DEFAULT '',
    "cost" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "out_of_service" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "close_condition" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_agency_id_tag_key" ON "assets"("agency_id", "tag");

-- CreateIndex
CREATE INDEX "asset_custody_agency_id_asset_id_idx" ON "asset_custody"("agency_id", "asset_id");

-- CreateIndex
CREATE INDEX "asset_custody_agency_id_shoot_id_idx" ON "asset_custody"("agency_id", "shoot_id");

-- CreateIndex
CREATE INDEX "asset_custody_agency_id_user_id_idx" ON "asset_custody"("agency_id", "user_id");

-- CreateIndex
CREATE INDEX "asset_reservations_agency_id_date_idx" ON "asset_reservations"("agency_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "asset_reservations_agency_id_asset_id_date_key" ON "asset_reservations"("agency_id", "asset_id", "date");

-- CreateIndex
CREATE INDEX "asset_maintenance_agency_id_asset_id_idx" ON "asset_maintenance"("agency_id", "asset_id");

-- AddForeignKey
ALTER TABLE "asset_custody" ADD CONSTRAINT "asset_custody_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_reservations" ADD CONSTRAINT "asset_reservations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_maintenance" ADD CONSTRAINT "asset_maintenance_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "assets" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "asset_custody" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_custody" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_custody" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "asset_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_reservations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_reservations" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "asset_maintenance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_maintenance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_maintenance" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "assets", "asset_custody", "asset_reservations", "asset_maintenance" TO genie_app;
  END IF;
END
$$;
