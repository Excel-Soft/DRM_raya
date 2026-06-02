-- Bring legacy users, tasks, projects tables up to current application schema

-- USERS
alter table users
  add column if not exists username text,
  add column if not exists password text,
  add column if not exists role_id text,
  add column if not exists branch text,
  add column if not exists country text,
  add column if not exists created_at timestamptz default now();

update users set
  username = coalesce(username, email),
  password = coalesce(password, ''),
  role_id = coalesce(role_id, 'sales_executive'),
  branch = coalesce(branch, 'HQ'),
  country = coalesce(country, 'UAE'),
  created_at = coalesce(created_at, now());

-- PROJECTS
alter table projects
  add column if not exists owner_user_id uuid,
  add column if not exists workspace text,
  add column if not exists status text default 'Active',
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update projects
  set owner_user_id = coalesce(owner_user_id, (select id from users limit 1)),
      status = coalesce(status, 'Active'),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, now());

-- TASKS
alter table tasks
  add column if not exists owner_user_id uuid,
  add column if not exists assigned_to_user_id uuid,
  add column if not exists participants text[] default '{}'::text[],
  add column if not exists category text default 'Work',
  add column if not exists priority text default 'Medium',
  add column if not exists status text default 'ToDo',
  add column if not exists start_date timestamptz,
  add column if not exists due_date timestamptz,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update tasks set
  owner_user_id = coalesce(owner_user_id, created_by),
  assigned_to_user_id = coalesce(assigned_to_user_id, assigned_to),
  status = coalesce(status, 'ToDo'),
  priority = coalesce(priority, 'Medium'),
  category = coalesce(category, 'Work'),
  participants = coalesce(participants, '{}'::text[]),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());
