-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "logo" TEXT,
ADD COLUMN     "metadata" TEXT;

-- AlterTable: roles are now defined by each agency (plan v1.1) - keep existing values.
ALTER TABLE "memberships" ALTER COLUMN "role" TYPE TEXT USING "role"::text;

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,
    "active_agency_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "invitations_agency_id_email_idx" ON "invitations"("agency_id", "email");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Security for sign-in
-- Better Auth connects as genie_auth, which may reach only the sign-in tables below.
-- The API and worker (genie_app) never see passwords, sessions or verification codes.

-- Invitations are agency data.
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "invitations" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

-- Users: the application sees only people who belong to the current agency, and the signed-in user.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY same_agency ON "users"
  USING ("id" = app_current_user() OR EXISTS (SELECT 1 FROM "memberships" m WHERE m."user_id" = "users"."id" AND m."agency_id" = app_current_agency()));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    REVOKE ALL ON "sessions", "accounts", "verifications" FROM genie_app;
    REVOKE INSERT, UPDATE, DELETE ON "users" FROM genie_app;
    GRANT SELECT ON "users" TO genie_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "invitations" TO genie_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_auth') THEN
    GRANT USAGE ON SCHEMA public TO genie_auth;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "users", "sessions", "accounts", "verifications", "agencies", "memberships", "invitations" TO genie_auth;
    GRANT EXECUTE ON FUNCTION app_current_agency(), app_current_user() TO genie_auth;
    -- Sign-in happens before an agency is chosen, so the auth service is not limited by agency.
    EXECUTE 'CREATE POLICY auth_service ON "users" TO genie_auth USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY auth_service ON "agencies" TO genie_auth USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY auth_service ON "memberships" TO genie_auth USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY auth_service ON "invitations" TO genie_auth USING (true) WITH CHECK (true)';
  END IF;
END
$$;
