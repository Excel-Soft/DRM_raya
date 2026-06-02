-- Add missing contact columns to customers for duplicate checks and new forms
alter table customers
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists mobile text;

-- Optional convenience index for duplicate detection (email exact match)
create index if not exists idx_customers_email_lower on customers (lower(email));
create index if not exists idx_customers_phone_digits on customers (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'));
create index if not exists idx_customers_mobile_digits on customers (regexp_replace(coalesce(mobile, ''), '[^0-9]', '', 'g'));
