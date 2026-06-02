-- Align task_templates table with current application schema (task templates repository expects these columns)

alter table "task_templates"
  add column if not exists "time" integer not null default 0,
  add column if not exists "detail" text,
  add column if not exists "repeat_daily" integer not null default 0,
  add column if not exists "department" text,
  add column if not exists "created_by_user_id" uuid,
  add column if not exists "is_active" integer not null default 1,
  add column if not exists "updated_at" timestamp with time zone default now();

-- So inserts that don't include the legacy template_json column still succeed
alter table "task_templates"
  alter column "template_json" drop not null,
  alter column "template_json" set default '{}'::jsonb;

-- Backfill updated_at for existing rows
update "task_templates"
set "updated_at" = coalesce("updated_at", now());
