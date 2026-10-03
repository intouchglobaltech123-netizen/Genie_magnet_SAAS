-- SOPs no longer carry a PSS line: PSS means password self-service, not part of an SOP.
-- AlterTable
ALTER TABLE "sops" DROP COLUMN "pss_ref";

