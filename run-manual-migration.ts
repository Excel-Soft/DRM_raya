import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function createTables() {
  console.log("Creating tables manually...");
  try {
    // Check if enum exists and create
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE drm.meeting_status AS ENUM ('expected', 'in_progress', 'ended');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE drm.meeting_person_type AS ENUM ('user', 'contact', 'external');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE drm.notice_assignment_status AS ENUM ('created', 'assigned', 'unread', 'read');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create meetings table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drm.meetings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid REFERENCES drm.customers(id),
        person_type drm.meeting_person_type NOT NULL DEFAULT 'contact',
        user_id uuid REFERENCES drm.users(id),
        contact_id uuid REFERENCES drm.customer_contacts(id),
        person_name text,
        meeting_type text NOT NULL,
        meeting_date timestamp with time zone NOT NULL DEFAULT now(),
        scheduled_time text,
        last_contact_time text,
        status drm.meeting_status NOT NULL DEFAULT 'expected',
        start_time timestamp with time zone,
        end_time timestamp with time zone,
        total_duration_seconds integer,
        file_url text,
        created_by uuid REFERENCES drm.users(id),
        updated_by uuid REFERENCES drm.users(id),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        updated_at timestamp with time zone NOT NULL DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_meeting_status ON drm.meetings(status);
      CREATE INDEX IF NOT EXISTS idx_meeting_date ON drm.meetings(meeting_date);
      CREATE INDEX IF NOT EXISTS idx_meeting_company ON drm.meetings(company_id);
    `);

    // Create notice_assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drm.notice_assignments (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        notice_id uuid NOT NULL REFERENCES drm.notices(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
        assigned_by_user_id uuid NOT NULL REFERENCES drm.users(id),
        assigned_at timestamp NOT NULL DEFAULT now(),
        read_status drm.notice_assignment_status NOT NULL DEFAULT 'unread'
      );
    `);

    // Alter drm_policies
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE drm.policy_status AS ENUM ('active', 'inactive');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      ALTER TABLE drm.drm_policies ADD COLUMN IF NOT EXISTS status drm.policy_status NOT NULL DEFAULT 'active';
      ALTER TABLE drm.drm_policies ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES drm.users(id);
    `);

    console.log("✅ Tables created successfully via manual SQL!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

createTables();
