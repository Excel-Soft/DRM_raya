-- Align temp_contacts with new schema used by app

-- Enum for status
do $$
begin
  if not exists (select 1 from pg_type where typname = 'temp_contact_status') then
    create type temp_contact_status as enum ('Pending', 'Promoted', 'Rejected');
  end if;
end$$;

-- Core columns
alter table temp_contacts
  add column if not exists user_id uuid references users(id),
  add column if not exists title text,
  add column if not exists person_name text,
  add column if not exists mobile text,
  add column if not exists source text,
  add column if not exists grade text,
  add column if not exists comment text,
  add column if not exists service_types text[] default '{}'::text[],
  add column if not exists status temp_contact_status default 'Pending',
  add column if not exists promoted_to_customer_id uuid references customers(id),
  add column if not exists promoted_at timestamp with time zone,
  add column if not exists promoted_by_user_id uuid references users(id);

-- Backfill legacy data
update temp_contacts
set
  person_name = coalesce(person_name, raw_name),
  mobile = coalesce(mobile, phone),
  grade = coalesce(grade, 'C'),
  status = coalesce(status, 'Pending')
where person_name is null or mobile is null or grade is null or status is null;

-- Basic indexes for lookups
create index if not exists idx_temp_contacts_email_lower on temp_contacts (lower(email));
create index if not exists idx_temp_contacts_mobile_digits on temp_contacts (regexp_replace(coalesce(mobile, ''), '[^0-9]', '', 'g'));
