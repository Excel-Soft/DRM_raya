-- Services master + follow-up services pivot
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists followup_services (
  followup_id uuid not null references follow_ups(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (followup_id, service_id)
);

create index if not exists idx_followup_services_followup on followup_services(followup_id);
create index if not exists idx_followup_services_service on followup_services(service_id);

alter table follow_ups
  add column if not exists method text,
  add column if not exists created_by uuid;

-- Seed common service types
insert into services (code, name)
values
  ('domain', 'Domain'),
  ('ssl', 'SSL'),
  ('hosting', 'Hosting')
on conflict (code) do update set name = excluded.name;
