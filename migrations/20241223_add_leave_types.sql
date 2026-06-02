-- Create leave_types if missing
create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_quota int not null default 0,
  created_at timestamptz not null default now()
);

-- Create leave_balances if missing
create table if not exists leave_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  leave_type_id uuid not null references leave_types(id) on delete cascade,
  year int not null,
  allocated int not null default 0,
  used int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, leave_type_id, year)
);

-- Ensure attendance unique per user/date
create unique index if not exists attendance_user_date_uq on attendance(user_id, date);

-- Seed basic leave types if table is empty
insert into leave_types (name, default_quota)
select t.name, t.default_quota
from (values ('Annual', 20), ('Sick', 10), ('Casual', 6)) as t(name, default_quota)
where not exists (select 1 from leave_types);
