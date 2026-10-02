-- Social connections (P3-11): a client platform connected through the platform's sign-in posts by itself and brings
-- in the numbers. Tokens are kept encrypted in the row (token_ref was never used).
ALTER TABLE "platform_connections" DROP COLUMN "token_ref";
UPDATE "platform_connections" SET "status" = 'manual' WHERE "status" = 'connected';
ALTER TABLE "platform_connections" ALTER COLUMN "status" SET DEFAULT 'manual';
ALTER TABLE "platform_connections" ADD COLUMN "external_id" TEXT,
ADD COLUMN "external_name" TEXT,
ADD COLUMN "access_token" TEXT,
ADD COLUMN "refresh_token" TEXT,
ADD COLUMN "token_expires_at" TIMESTAMP(3),
ADD COLUMN "pending" TEXT,
ADD COLUMN "auto_publish" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "last_error" TEXT,
ADD COLUMN "linked_at" TIMESTAMP(3),
ADD COLUMN "linked_by" TEXT;

ALTER TABLE "scheduled_posts" ADD COLUMN "published_via" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "external_id" TEXT,
ADD COLUMN "publish_error" TEXT;
