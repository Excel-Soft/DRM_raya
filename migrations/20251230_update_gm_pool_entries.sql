-- Align gm_pool_entries table with application schema expectations

-- Ensure enum exists for gm pool status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'gm_pool_status') then
    create type gm_pool_status as enum ('Active', 'Pending', 'Inactive');
  end if;
end$$;

-- Normalize status column to enum with a sane default
alter table gm_pool_entries
  alter column status drop default;

update gm_pool_entries
set status = 'Pending'
where status is null or status not in ('Active', 'Pending', 'Inactive');

alter table gm_pool_entries
  alter column status type gm_pool_status using
    case
      when status in ('Active', 'Pending', 'Inactive') then status::gm_pool_status
      else 'Pending'::gm_pool_status
    end,
  alter column status set default 'Pending',
  alter column status set not null;

-- Customer link is optional in the app; relax the constraint to match
alter table gm_pool_entries
  alter column customer_id drop not null;

-- Add missing columns used by the API (add nullable first to allow backfill)
alter table gm_pool_entries
  add column if not exists member_id varchar,
  add column if not exists order_id varchar,
  add column if not exists sales_person_id uuid references users(id),
  add column if not exists package text,
  add column if not exists dollar_rate numeric(10, 2),
  add column if not exists discount numeric(5, 2) default 0,
  add column if not exists hod_approved integer default 0,
  add column if not exists accountant_verified integer default 0;

-- Backfill sensible defaults for any existing rows
update gm_pool_entries
set
  member_id = coalesce(member_id, 'UNKNOWN'),
  order_id = coalesce(order_id, 'UNKNOWN'),
  package = coalesce(package, 'Unknown'),
  dollar_rate = coalesce(dollar_rate, 0),
  discount = coalesce(discount, 0),
  hod_approved = coalesce(hod_approved, 0),
  accountant_verified = coalesce(accountant_verified, 0)
where
  member_id is null
  or order_id is null
  or package is null
  or dollar_rate is null
  or discount is null
  or hod_approved is null
  or accountant_verified is null;

-- Try to align sales_person_id with customer owner where possible
update gm_pool_entries g
set sales_person_id = coalesce(g.sales_person_id, c.owner_user_id)
from customers c
where g.customer_id = c.id and g.sales_person_id is null;

-- Fall back to the first user if nothing else is available
update gm_pool_entries
set sales_person_id = (
  select id from users order by created_at limit 1
)
where sales_person_id is null
  and exists (select 1 from users);

-- Enforce non-nullable columns and keep defaults where appropriate
alter table gm_pool_entries
  alter column member_id set not null,
  alter column order_id set not null,
  alter column package set not null,
  alter column dollar_rate set not null,
  alter column discount set not null,
  alter column hod_approved set not null,
  alter column accountant_verified set not null,
  alter column sales_person_id set not null;

alter table gm_pool_entries
  alter column discount set default 0,
  alter column hod_approved set default 0,
  alter column accountant_verified set default 0;
