-- Attendance TODO module (staging / legacy parity)
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

-- One-time backfill from legacy_archive.webxl_todo_list (idempotent via legacy_id)
INSERT INTO drm.todo_tasks (
  created_by_user_id,
  title,
  category,
  description,
  priority,
  repeat,
  reminder,
  due_date,
  due_time,
  participants,
  status,
  legacy_id,
  created_at,
  updated_at
)
SELECT
  owner_map.modern_id::uuid,
  COALESCE(NULLIF(trim(t.task_tile), ''), 'Untitled task'),
  NULLIF(trim(t.category), ''),
  NULLIF(trim(t.task_des), ''),
  UPPER(COALESCE(NULLIF(trim(t.priority), ''), 'MEDIUM')),
  UPPER(COALESCE(NULLIF(trim(t.repeat_alert), ''), 'NONE')),
  COALESCE(NULLIF(trim(t.reminder), ''), 'same_day'),
  CASE
    WHEN NULLIF(trim(t.end_date), '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     AND trim(t.end_date) !~ '^0000-'
     AND trim(t.end_date)::date >= DATE '1970-01-01'
      THEN trim(t.end_date)::date
    ELSE NULL
  END,
  NULLIF(trim(t.time), ''),
  (
    SELECT array_agg(DISTINCT p_map.modern_id::text)
    FROM unnest(string_to_array(COALESCE(t.partici, ''), ',')) AS raw_pid(pid)
    JOIN migration_meta.migration_legacy_ids p_map
      ON p_map.entity_type = 'user'
     AND p_map.legacy_table = 'webxl_user'
     AND p_map.legacy_id = trim(raw_pid.pid)
    WHERE trim(raw_pid.pid) <> ''
  ),
  CASE lower(trim(COALESCE(t.status, '')))
    WHEN 'complete' THEN 'FINISHED'
    WHEN 'completed' THEN 'FINISHED'
    WHEN 'done' THEN 'FINISHED'
    WHEN 'proceeded' THEN 'RECEIVED'
    WHEN 'received' THEN 'RECEIVED'
    WHEN 'pending' THEN 'PENDING'
    WHEN 'assign' THEN 'ASSIGNED'
    WHEN 'assigned' THEN 'ASSIGNED'
    ELSE 'PENDING'
  END,
  NULLIF(trim(t._legacy_pk), ''),
  CASE
    WHEN NULLIF(trim(t.create_at), '') ~ '^[0-9]{4}-'
     AND trim(t.create_at) !~ '^0000-'
      THEN trim(t.create_at)::timestamptz
    ELSE now()
  END,
  now()
FROM legacy_archive.webxl_todo_list t
JOIN migration_meta.migration_legacy_ids owner_map
  ON owner_map.entity_type = 'user'
 AND owner_map.legacy_table = 'webxl_user'
 AND owner_map.legacy_id = trim(t.user_id)
WHERE owner_map.modern_id IS NOT NULL
ON CONFLICT (legacy_id) WHERE legacy_id IS NOT NULL DO NOTHING;
