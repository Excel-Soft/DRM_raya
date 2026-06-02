-- Lead services (expiry tracking)
create table if not exists lead_services (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references customers(id) on delete cascade,
  service_type text not null check (service_type in ('domain','ssl','hosting')),
  expiry_date timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_services_lead on lead_services(lead_id);
create index if not exists idx_lead_services_type on lead_services(service_type);
