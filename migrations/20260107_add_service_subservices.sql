-- Master sub-services for Follow The Customer
create table if not exists service_subservices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists followup_subservices (
  followup_id uuid not null references follow_ups(id) on delete cascade,
  subservice_id uuid not null references service_subservices(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (followup_id, subservice_id)
);

create index if not exists idx_service_subservices_service on service_subservices(service_id);
create index if not exists idx_followup_subservices_followup on followup_subservices(followup_id);

-- Reset to fresh uuid schema (safe for new feature; drop if exists)
drop table if exists followup_subservices cascade;
drop table if exists service_subservices cascade;

create table service_subservices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(service_id, code)
);

create table followup_subservices (
  followup_id uuid not null references follow_ups(id) on delete cascade,
  subservice_id uuid not null references service_subservices(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (followup_id, subservice_id)
);

-- Seed sub-services for all four services
insert into service_subservices (service_id, code, name, is_active)
select s.id, sub_code, sub_name, true
from (values
  ('ALIBABA_MEMBERSHIP','AM_ACCOUNT_SETUP','Account Setup'),
  ('ALIBABA_MEMBERSHIP','AM_TRAINING','Training & Onboarding'),
  ('ALIBABA_MEMBERSHIP','AM_OPTIMIZATION','Profile Optimization'),
  ('ALIBABA_SERVICES','AS_PRODUCT_LISTING','Product Listing'),
  ('ALIBABA_SERVICES','AS_ADS','Advertising / PPC'),
  ('ALIBABA_SERVICES','AS_OPTIMIZATION','Ongoing Optimization'),
  ('DESIGN_DEVELOPMENT','DD_WEBSITE','Website Design'),
  ('DESIGN_DEVELOPMENT','DD_LANDING','Landing Page'),
  ('DESIGN_DEVELOPMENT','DD_BRANDING','Branding / Visuals'),
  ('DOMAIN_HOSTING','DH_DOMAIN','Domain Purchase'),
  ('DOMAIN_HOSTING','DH_HOSTING','Hosting Plan'),
  ('DOMAIN_HOSTING','DH_SSL','SSL / Security')
) as v(service_code, sub_code, sub_name)
join services s on s.code = v.service_code
on conflict (code) do update set
  name = excluded.name,
  service_id = excluded.service_id,
  is_active = excluded.is_active;
