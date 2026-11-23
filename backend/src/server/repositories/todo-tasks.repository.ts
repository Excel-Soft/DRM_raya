import { pool } from "../db";

let schemaEnsured = false;

export async function ensureTodoTasksSchema(): Promise<void> {
  if (schemaEnsured) return;

  const exists = await pool.query(`SELECT to_regclass('drm.todo_tasks') AS reg`);
  if (exists.rows[0]?.reg) {
    schemaEnsured = true;
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS drm.todo_tasks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_by_user_id uuid NOT NULL REFERENCES drm.users(id) ON DELETE CASCADE,
      title text NOT NULL,
      category text,
      description text,
      priority text NOT NULL DEFAULT 'MEDIUM',
      repeat text NOT NULL DEFAULT 'NONE',
      reminder text NOT NULL DEFAULT 'same_day',
      due_date date,
      due_time text,
      participants text[],
      status text NOT NULL DEFAULT 'ASSIGNED',
      legacy_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON drm.todo_tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON drm.todo_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_todo_tasks_created_by ON drm.todo_tasks(created_by_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_todo_tasks_legacy_id ON drm.todo_tasks(legacy_id) WHERE legacy_id IS NOT NULL;
  `);
  schemaEnsured = true;
}
