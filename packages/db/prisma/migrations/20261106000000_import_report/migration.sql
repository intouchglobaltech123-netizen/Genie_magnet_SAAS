-- Each import keeps its check report (P3-12).
ALTER TABLE "imports" ADD COLUMN "report" JSONB;
