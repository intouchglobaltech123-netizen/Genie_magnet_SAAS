-- People (P5-06 to P5-08): departments, employee records, attendance and leave.

CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "head_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_profiles" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_code" TEXT,
    "department_id" UUID,
    "designation" TEXT,
    "employment_type" TEXT NOT NULL DEFAULT 'full_time',
    "joining_date" DATE,
    "exit_date" DATE,
    "phone" TEXT,
    "personal_email" TEXT,
    "date_of_birth" DATE,
    "address" TEXT,
    "emergency_name" TEXT,
    "emergency_phone" TEXT,
    "bank_account" TEXT,
    "bank_hint" TEXT,
    "ifsc" TEXT,
    "pan" TEXT,
    "pan_hint" TEXT,
    "uan" TEXT,
    "esi_number" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_settings" (
    "agency_id" UUID NOT NULL,
    "workday_start" TEXT NOT NULL DEFAULT '09:30',
    "late_after" INTEGER NOT NULL DEFAULT 15,
    "half_day_below" INTEGER NOT NULL DEFAULT 240,
    "weekly_offs" INTEGER[] DEFAULT ARRAY[0]::INTEGER[],
    "holidays" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_settings_pkey" PRIMARY KEY ("agency_id")
);

CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "first_in" TEXT,
    "last_out" TEXT,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'import',
    "import_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "first_in" TEXT,
    "last_out" TEXT,
    "reason" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_types" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "days_per_year" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "carry_forward" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "type_id" UUID NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "half_day" BOOLEAN NOT NULL DEFAULT false,
    "days" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_agency_id_name_key" ON "departments"("agency_id", "name");
CREATE UNIQUE INDEX "employee_profiles_agency_id_user_id_key" ON "employee_profiles"("agency_id", "user_id");
CREATE UNIQUE INDEX "employee_profiles_agency_id_employee_code_key" ON "employee_profiles"("agency_id", "employee_code");
CREATE INDEX "attendance_records_agency_id_date_idx" ON "attendance_records"("agency_id", "date");
CREATE UNIQUE INDEX "attendance_records_agency_id_user_id_date_key" ON "attendance_records"("agency_id", "user_id", "date");
CREATE INDEX "attendance_corrections_agency_id_state_idx" ON "attendance_corrections"("agency_id", "state");
CREATE UNIQUE INDEX "leave_types_agency_id_name_key" ON "leave_types"("agency_id", "name");
CREATE INDEX "leave_requests_agency_id_user_id_idx" ON "leave_requests"("agency_id", "user_id");
CREATE INDEX "leave_requests_agency_id_status_idx" ON "leave_requests"("agency_id", "status");

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row-level security.
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "departments" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "departments" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "employee_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "employee_profiles" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "attendance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_settings" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_records" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "attendance_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_corrections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_corrections" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leave_types" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "leave_requests" USING ("agency_id" = app_current_agency()) WITH CHECK ("agency_id" = app_current_agency());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'genie_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "departments", "employee_profiles", "attendance_settings", "attendance_records", "attendance_corrections", "leave_types", "leave_requests" TO genie_app;
  END IF;
END
$$;
