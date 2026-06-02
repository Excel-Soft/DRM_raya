-- Align task_templates table with application schema expectations
alter table task_templates
  add column if not exists time integer not null default 0,
  add column if not exists detail text,
  add column if not exists repeat_daily integer not null default 0,
  add column if not exists department text,
  add column if not exists created_by_user_id uuid,
  add column if not exists is_active integer not null default 1,
  add column if not exists updated_at timestamptz default now();

-- Backfill updated_at for existing rows
update task_templates
set updated_at = coalesce(updated_at, now());
