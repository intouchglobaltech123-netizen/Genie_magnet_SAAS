-- Clients and contacts (P1-18), agreements (P1-19), and the agency's renewal notice.

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "renewal_notice_days" INTEGER NOT NULL DEFAULT 45;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "billing_address" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "archived_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "agreements" ADD COLUMN     "deliverables" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "shoot_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status_note" TEXT,
ADD COLUMN     "renews_id" UUID,
ADD COLUMN     "signed_by" TEXT,
ADD COLUMN     "signed_at" TIMESTAMP(3),
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Due for renewal is now worked out from the end date and the agency's notice, not stored as a status.
-- (Migrations run as the database owner, which row-level security does not limit.)
UPDATE "agreements" SET "status" = 'active' WHERE "status" = 'renewal_due';

-- Agreements made before this keep their package's deliverables as their monthly quotas.
UPDATE "agreements" a
   SET "deliverables" = p."deliverables", "shoot_days" = p."shoot_days", "platforms" = p."platforms"
  FROM "packages" p
 WHERE a."package_id" = p."id";

-- CreateIndex
CREATE INDEX "agreements_agency_id_renews_id_idx" ON "agreements"("agency_id", "renews_id");
