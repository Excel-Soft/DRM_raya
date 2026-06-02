-- Align task status history with shared schema (user_id + notes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_status_history' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE task_status_history ADD COLUMN user_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_status_history' AND column_name = 'notes'
  ) THEN
    ALTER TABLE task_status_history ADD COLUMN notes text;
  END IF;
END $$;

-- Backfill the user_id from the legacy changed_by column when present
UPDATE task_status_history
SET user_id = COALESCE(user_id, changed_by)
WHERE user_id IS NULL AND changed_by IS NOT NULL;

-- Keep an FK for the new column, but only add it once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_status_history_user_id_users_id_fk'
  ) THEN
    ALTER TABLE task_status_history
      ADD CONSTRAINT task_status_history_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'task_status_history_user_id_idx'
  ) THEN
    CREATE INDEX task_status_history_user_id_idx ON task_status_history (user_id);
  END IF;
END $$;

-- Align task time logs with shared schema (log_date + time_spent_minutes + description)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_time_logs' AND column_name = 'time_spent_minutes'
  ) THEN
    ALTER TABLE task_time_logs ADD COLUMN time_spent_minutes integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_time_logs' AND column_name = 'description'
  ) THEN
    ALTER TABLE task_time_logs ADD COLUMN description text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_time_logs' AND column_name = 'log_date'
  ) THEN
    ALTER TABLE task_time_logs ADD COLUMN log_date timestamptz;
  END IF;
END $$;

-- Backfill new columns from the legacy shape
UPDATE task_time_logs
SET time_spent_minutes = COALESCE(
  time_spent_minutes,
  duration_minutes,
  GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (COALESCE(end_at, start_at) - start_at)) / 60)::int,
    0
  )
)
WHERE time_spent_minutes IS NULL;

UPDATE task_time_logs
SET description = COALESCE(description, notes)
WHERE description IS NULL AND notes IS NOT NULL;

UPDATE task_time_logs
SET log_date = COALESCE(log_date, start_at, created_at, NOW())
WHERE log_date IS NULL;

-- Add defaults/constraints after backfill
ALTER TABLE task_time_logs
  ALTER COLUMN log_date SET DEFAULT now();

UPDATE task_time_logs
SET time_spent_minutes = 0
WHERE time_spent_minutes IS NULL;

DO $$
BEGIN
  -- Only enforce NOT NULL after we've filled data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_time_logs' AND column_name = 'time_spent_minutes'
  ) THEN
    ALTER TABLE task_time_logs
      ALTER COLUMN time_spent_minutes SET DEFAULT 0,
      ALTER COLUMN time_spent_minutes SET NOT NULL;
  END IF;
END $$;

ALTER TABLE task_time_logs
  ALTER COLUMN log_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'task_time_logs_log_date_idx'
  ) THEN
    CREATE INDEX task_time_logs_log_date_idx ON task_time_logs (log_date);
  END IF;
END $$;
