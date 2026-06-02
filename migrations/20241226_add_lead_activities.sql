-- Lead activities log to track user actions on leads/customers
create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  action text not null,
  performed_by uuid not null references users(id),
  note text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lead_activities_customer on lead_activities(customer_id);
create index if not exists idx_lead_activities_created on lead_activities(created_at desc);
