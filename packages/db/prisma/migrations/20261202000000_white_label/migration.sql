-- White-label (P6-07): the brand colour in the team's own app, and the agency's own address for its client links.
-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "app_branding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "portal_domain" TEXT,
ADD COLUMN     "portal_domain_token" TEXT,
ADD COLUMN     "portal_domain_verified_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_portal_domain_key" ON "agencies"("portal_domain");

