-- Each agreement's invoice drafted by itself on its billing day (P5-04).
ALTER TABLE "invoice_settings" ADD COLUMN "auto_draft" BOOLEAN NOT NULL DEFAULT true;
