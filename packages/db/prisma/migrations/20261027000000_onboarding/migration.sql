-- The onboarding engine (P1-21 to P1-25): question versions, responses with a private link, checklist, exceptions, reminders.

-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "onboarding_mode" TEXT NOT NULL DEFAULT 'link';

-- AlterTable
ALTER TABLE "questionnaire_reminders" ADD COLUMN     "sent_by" TEXT;

-- AlterTable
ALTER TABLE "questionnaire_responses" ADD COLUMN     "checklist" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "exception_at" TIMESTAMP(3),
ADD COLUMN     "exception_by" TEXT,
ADD COLUMN     "exception_reason" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';

-- AlterTable
ALTER TABLE "questionnaire_templates" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "questionnaire_reminders_response_id_day_key" ON "questionnaire_reminders"("response_id", "day");


-- The private questionnaire link (P1-22): a transaction that sets app.link_token to a token hash may read that one
-- response, without knowing its agency (findQuestionnaireLink in packages/db). Everything else stays agency-scoped.
CREATE POLICY link_access ON "questionnaire_responses" FOR SELECT USING ("token" = current_setting('app.link_token', true));
