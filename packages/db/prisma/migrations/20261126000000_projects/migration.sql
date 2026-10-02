-- Projects and tasks (P5-21): projects, their tasks, and the agency's task lists.

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "client_id" UUID,
    "owner_id" TEXT NOT NULL,
    "joiner_id" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "start_on" DATE,
    "due_on" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "template_key" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "project_id" UUID,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "owner_id" TEXT NOT NULL,
    "due_on" DATE,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'todo',
    "depends_on_id" UUID,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "commitment_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_settings" (
    "agency_id" UUID NOT NULL,
    "templates" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("agency_id")
);

-- CreateIndex
CREATE INDEX "projects_agency_id_status_idx" ON "projects"("agency_id", "status");

-- CreateIndex
CREATE INDEX "tasks_agency_id_owner_id_status_idx" ON "tasks"("agency_id", "owner_id", "status");

-- CreateIndex
CREATE INDEX "tasks_agency_id_project_id_idx" ON "tasks"("agency_id", "project_id");

-- CreateIndex
CREATE INDEX "tasks_agency_id_commitment_id_idx" ON "tasks"("agency_id", "commitment_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_depends_on_id_fkey" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row-level security.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "projects" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tasks" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "project_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "project_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "projects", "tasks", "project_settings" TO genie_app;
  END IF;
END
$$;
