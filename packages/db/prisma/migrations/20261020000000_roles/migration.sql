-- Roles and the permission matrix (P1-11). Each agency edits its own copy of the default roles.

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_client" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_agency_id_key_key" ON "roles"("agency_id", "key");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security: an agency sees only its own roles.
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

-- The API manages roles; the sign-in role never needs them.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "roles" TO genie_app;
  END IF;
END
$$;
