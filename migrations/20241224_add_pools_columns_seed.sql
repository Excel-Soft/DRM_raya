-- Add pool-related columns to customers and seed sample leads across pools
alter table customers
  add column if not exists owner_user_id uuid,
  add column if not exists pool_type text not null default 'Public',
  add column if not exists expires_at date;

create index if not exists idx_customers_pool_type on customers(pool_type);
create index if not exists idx_customers_owner on customers(owner_user_id);
create index if not exists idx_customers_expires on customers(expires_at);

-- Seed sample leads only if none exist in pools
do $$
declare
  cnt int;
  u_self uuid;
begin
  select count(*) into cnt from customers;
  select id into u_self from users order by created_at asc limit 1;
  if cnt < 20 then
    insert into customers (id, company_name, region, grade, status, source, created_by, owner_user_id, pool_type, expires_at, created_at, updated_at)
    select gen_random_uuid(), 'Sample Lead ' || g, 'GCC', 'B', 'New', 'Web', u_self, u_self, 'Private', current_date + (g % 15), now(), now()
    from generate_series(1,10) g;

    insert into customers (id, company_name, region, grade, status, source, created_by, owner_user_id, pool_type, expires_at, created_at, updated_at)
    select gen_random_uuid(), 'Service Lead ' || g, 'PK', 'C', 'New', 'Referral', u_self, null, 'Service', current_date + (g % 20), now(), now()
    from generate_series(1,5) g;

    insert into customers (id, company_name, region, grade, status, source, created_by, owner_user_id, pool_type, expires_at, created_at, updated_at)
    select gen_random_uuid(), 'Public Lead ' || g, 'UAE', 'A', 'New', 'Email', u_self, null, 'Public', current_date + (g % 10), now(), now()
    from generate_series(1,5) g;
  end if;
end$$;
