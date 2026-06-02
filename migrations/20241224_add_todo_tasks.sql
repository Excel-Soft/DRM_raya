-- To Do tasks for Attendance module
create table if not exists todo_tasks (
  id uuid primary key default gen_random_uuid(),
  created_by_user_id uuid not null,
  title text not null,
  category text,
  description text,
  priority text not null default 'MEDIUM',
  repeat text default 'NONE',
  reminder text default 'same_day',
  due_date date not null,
  due_time time,
  participants text[],
  attachment_name text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_todo_tasks_user on todo_tasks (created_by_user_id, due_date desc);
