import { pool } from "../server/db";

async function createTables() {
  const client = await pool.connect();
  try {
    console.log("Creating product_posting tables...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.product_posting_phase_definitions (
        phase_key VARCHAR(64) PRIMARY KEY,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
        can_return BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.product_posting_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES drm.projects(id) ON DELETE CASCADE UNIQUE,
        task_id UUID REFERENCES drm.tasks(id) ON DELETE SET NULL UNIQUE,
        current_phase TEXT NOT NULL DEFAULT 'PENDING_PROJECT',
        salesperson_uploaded_at TIMESTAMP,
        data_verified_at TIMESTAMP,
        assigned_at TIMESTAMP,
        assigned_duration_minutes INTEGER NOT NULL DEFAULT 0,
        execution_started_at TIMESTAMP,
        executive_submitted_at TIMESTAMP,
        manager_completed_at TIMESTAMP,
        qa_reviewed_at TIMESTAMP,
        verification_reviewed_at TIMESTAMP,
        manager_user_id UUID REFERENCES drm.users(id),
        executive_user_id UUID REFERENCES drm.users(id),
        qa_user_id UUID REFERENCES drm.users(id),
        verification_user_id UUID REFERENCES drm.users(id),
        overtime_requested_minutes INTEGER NOT NULL DEFAULT 0,
        overtime_approved_minutes INTEGER NOT NULL DEFAULT 0,
        overtime_reason TEXT,
        output_notes TEXT,
        qa_remarks TEXT,
        verification_remarks TEXT,
        return_count INTEGER NOT NULL DEFAULT 0,
        last_return_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.product_posting_evidence_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES drm.product_posting_workflows(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES drm.projects(id) ON DELETE CASCADE,
        task_id UUID REFERENCES drm.tasks(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        label TEXT,
        link_type TEXT NOT NULL DEFAULT 'output',
        created_by_user_id UUID NOT NULL REFERENCES drm.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.product_posting_rework_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES drm.product_posting_workflows(id) ON DELETE CASCADE,
        from_phase TEXT,
        to_phase TEXT NOT NULL,
        action TEXT NOT NULL,
        remarks TEXT,
        actor_user_id UUID NOT NULL REFERENCES drm.users(id),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drm.product_posting_commission_slabs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        min_value INTEGER NOT NULL DEFAULT 0,
        max_value INTEGER,
        commission_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
        rate_type TEXT NOT NULL DEFAULT 'percentage',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    console.log("Tables created successfully.");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    client.release();
    pool.end();
  }
}

createTables();
