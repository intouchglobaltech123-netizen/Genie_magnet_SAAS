-- Agency profile and branding (P1-12) and packages with a list of deliverables (P1-13).

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "brand_color" TEXT,
ADD COLUMN     "business_stage" "BusinessStage",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "reminder_days" INTEGER[] DEFAULT ARRAY[2, 5]::INTEGER[],
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "billing" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deliverables" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "description" TEXT;

-- Packages made before deliverables existed get them from their totals.
UPDATE "packages" SET "deliverables" =
  (CASE WHEN "videos_per_month" > 0 THEN jsonb_build_array(jsonb_build_object('name', 'Videos', 'perMonth', "videos_per_month", 'kind', 'video')) ELSE '[]'::jsonb END)
  || (CASE WHEN "posts_per_month" > 0 THEN jsonb_build_array(jsonb_build_object('name', 'Posts', 'perMonth', "posts_per_month", 'kind', 'post')) ELSE '[]'::jsonb END)
WHERE "deliverables" = '[]'::jsonb;
