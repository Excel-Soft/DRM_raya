import { pool } from "./db";

const sqlQueries = `
DO $$ BEGIN
    CREATE TYPE service_customer_status AS ENUM ('new', 'trial', 'active', 'overdue', 'expired_grace', 'expired_hard', 'renewed', 'upgraded');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE service_followup_status AS ENUM ('pending', 'completed', 'rescheduled', 'missed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE service_complaint_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE service_dropout_status AS ENUM ('pending_recovery', 'recovered', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE service_renewal_type AS ENUM ('renewal', 'upgrade');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "service_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "customer_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE cascade,
  "package_id" uuid REFERENCES "services"("id"),
  "start_date" timestamp NOT NULL,
  "expiry_date" timestamp NOT NULL,
  "status" service_customer_status NOT NULL DEFAULT 'new',
  "assigned_to" uuid REFERENCES "users"("id"),
  "assigned_by" uuid REFERENCES "users"("id"),
  "assigned_at" timestamp,
  "status_changed_at" timestamp,
  "created_by" uuid REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_service_customers_status" ON "service_customers" ("status");
CREATE INDEX IF NOT EXISTS "idx_service_customers_expiry" ON "service_customers" ("expiry_date");
CREATE INDEX IF NOT EXISTS "idx_service_customers_assigned_to" ON "service_customers" ("assigned_to");

CREATE TABLE IF NOT EXISTS "service_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "month" integer NOT NULL,
  "year" integer NOT NULL,
  "target_type" varchar NOT NULL,
  "target_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "achieved_amount" numeric(12, 2) NOT NULL DEFAULT 0.00,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_service_targets_user_month" ON "service_targets" ("user_id", "month", "year");

CREATE TABLE IF NOT EXISTS "service_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "service_customer_id" uuid REFERENCES "service_customers"("id") ON DELETE cascade,
  "company_id" uuid REFERENCES "customers"("id"),
  "method" text NOT NULL,
  "duration_minutes" integer NOT NULL DEFAULT 0,
  "target_value" numeric(10, 2),
  "achieved_value" numeric(10, 2),
  "remarks" text,
  "activity_date" timestamp NOT NULL DEFAULT now(),
  "created_by" uuid REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_service_activities_user_id" ON "service_activities" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_service_activities_activity_date" ON "service_activities" ("activity_date");

CREATE TABLE IF NOT EXISTS "service_followups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_customer_id" uuid NOT NULL REFERENCES "service_customers"("id") ON DELETE cascade,
  "customer_id" uuid REFERENCES "customers"("id"),
  "company_id" uuid REFERENCES "customers"("id"),
  "assigned_to" uuid REFERENCES "users"("id"),
  "method" text NOT NULL,
  "purpose" text,
  "status" service_followup_status NOT NULL DEFAULT 'pending',
  "note" text,
  "next_followup_date" timestamp,
  "completed_at" timestamp,
  "created_by" uuid REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "status_changed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_service_followups_next_followup_date" ON "service_followups" ("next_followup_date");

CREATE TABLE IF NOT EXISTS "service_complaints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_customer_id" uuid NOT NULL REFERENCES "service_customers"("id") ON DELETE cascade,
  "customer_id" uuid REFERENCES "customers"("id"),
  "company_id" uuid REFERENCES "customers"("id"),
  "title" text NOT NULL,
  "description" text,
  "priority" text NOT NULL DEFAULT 'medium',
  "assigned_to" uuid REFERENCES "users"("id"),
  "status" service_complaint_status NOT NULL DEFAULT 'open',
  "remarks" text,
  "resolved_at" timestamp,
  "created_by" uuid REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "status_changed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_service_complaints_status" ON "service_complaints" ("status");

CREATE TABLE IF NOT EXISTS "service_dropouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_customer_id" uuid NOT NULL REFERENCES "service_customers"("id") ON DELETE cascade,
  "customer_id" uuid REFERENCES "customers"("id"),
  "company_id" uuid REFERENCES "customers"("id"),
  "reason" text NOT NULL,
  "status" service_dropout_status NOT NULL DEFAULT 'pending_recovery',
  "recovery_note" text,
  "recovered_at" timestamp,
  "closed_at" timestamp,
  "created_by" uuid REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "status_changed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_service_dropouts_status" ON "service_dropouts" ("status");

CREATE TABLE IF NOT EXISTS "service_renewals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_customer_id" uuid NOT NULL REFERENCES "service_customers"("id") ON DELETE cascade,
  "old_package_id" uuid REFERENCES "services"("id"),
  "new_package_id" uuid REFERENCES "services"("id"),
  "old_gm_record_id" uuid REFERENCES "gm_entries"("id"),
  "new_gm_record_id" uuid REFERENCES "gm_entries"("id"),
  "renewal_type" service_renewal_type NOT NULL DEFAULT 'renewal',
  "old_expiry_date" timestamp,
  "new_start_date" timestamp,
  "new_expiry_date" timestamp,
  "amount" numeric(12, 2),
  "status" text NOT NULL DEFAULT 'completed',
  "created_by" uuid REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
`;

async function runMigration() {
  console.log("Starting custom database migration for Service Department...");
  try {
    await pool.query(sqlQueries);
    console.log("✅ Service tables securely injected into the database without touching any other fields!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

runMigration();
