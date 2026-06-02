-- Improve duplicate checks for temporary contacts and customers
create index if not exists idx_temp_contacts_email_lower on temp_contacts (lower(email));
create index if not exists idx_temp_contacts_mobile_digits on temp_contacts (regexp_replace(mobile, '[^0-9]', '', 'g'));

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'customers' and column_name = 'email') then
    execute 'create index if not exists idx_customers_email_lower on customers (lower(email))';
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'customers' and column_name = 'phone') then
    execute 'create index if not exists idx_customers_phone_digits on customers (regexp_replace(phone, ''[^0-9]'', '''', ''g''))';
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'customers' and column_name = 'mobile') then
    execute 'create index if not exists idx_customers_mobile_digits on customers (regexp_replace(mobile, ''[^0-9]'', '''', ''g''))';
  end if;
end$$;
