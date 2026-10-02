-- STOP reviews (P5-14) and decisions and commitments (P5-16): each agency's review rhythms, meetings with notes,
-- attendance and a snapshot of the figures, decisions, and commitments carried forward until done.

-- DropForeignKey
ALTER TABLE "commitments" DROP CONSTRAINT "commitments_meeting_id_fkey";

-- AlterTable
ALTER TABLE "commitments" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "done_at" TIMESTAMP(3),
ADD COLUMN     "history" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "mark_note" TEXT,
ALTER COLUMN "meeting_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "agenda" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "attendance" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "facilitator_id" TEXT,
ADD COLUMN     "notes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "participant_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recognitions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "snapshot" JSONB,
ADD COLUMN     "venue" TEXT;

-- CreateTable
CREATE TABLE "review_cadences" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "cadence" "ReviewCadence" NOT NULL,
    "name" TEXT NOT NULL,
    "every_days" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "minutes" INTEGER NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '',
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "facilitator_id" TEXT,
    "participant_ids" TEXT[],
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "blocks" TEXT[],

    CONSTRAINT "review_cadences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "meeting_id" UUID,
    "text" TEXT NOT NULL,
    "owner_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_cadences_agency_id_cadence_key" ON "review_cadences"("agency_id", "cadence");

-- CreateIndex
CREATE INDEX "decisions_agency_id_created_at_idx" ON "decisions"("agency_id", "created_at");

-- CreateIndex
CREATE INDEX "meetings_agency_id_starts_at_idx" ON "meetings"("agency_id", "starts_at");

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "review_cadences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_cadences" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "review_cadences" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "decisions" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "review_cadences", "decisions" TO genie_app;
  END IF;
END
$$;
