-- Payments (P3-10): each agency's own Razorpay account, payment links on invoices, and payments received.

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "pay_link_error" TEXT,
ADD COLUMN     "pay_link_id" TEXT,
ADD COLUMN     "pay_link_status" TEXT,
ADD COLUMN     "pay_link_url" TEXT;

-- CreateTable
CREATE TABLE "payment_connections" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "key_id" TEXT NOT NULL,
    "key_secret" TEXT NOT NULL,
    "secret_hint" TEXT NOT NULL,
    "webhook_secret" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unchecked',
    "last_error" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'razorpay',
    "provider_payment_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_connections_agency_id_key" ON "payment_connections"("agency_id");

-- CreateIndex
CREATE INDEX "payments_agency_id_invoice_id_idx" ON "payments"("agency_id", "invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_agency_id_provider_payment_id_key" ON "payments"("agency_id", "provider_payment_id");



-- Row-level security. Razorpay's notices arrive at an address with the connection's id; a transaction that sets
-- app.payment_connection to that id can read that one connection (policy webhook_access), and nothing else.
ALTER TABLE "payment_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payment_connections" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());
CREATE POLICY webhook_access ON "payment_connections" FOR SELECT USING ("id"::text = current_setting('app.payment_connection', true));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_connections", "payments" TO genie_app;
  END IF;
END
$$;
