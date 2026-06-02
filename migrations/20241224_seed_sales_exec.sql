-- Seed sample sales data for the sales executive dashboard (non-destructive, skips if rows already exist)
do $$
declare
  v_user uuid := 'c54efe31-d40c-4652-a675-0ddbfaea67fd'; -- talha@excels-tech.com
  v_cust1 uuid := gen_random_uuid();
  v_cust2 uuid := gen_random_uuid();
  v_cust3 uuid := gen_random_uuid();
  v_cust4 uuid := gen_random_uuid();
  v_cust5 uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_today date := current_date;
begin
  -- Customers (lightweight columns only)
  if not exists (select 1 from customers where company_name = 'Acme Imports' and created_by = v_user) then
    insert into customers (id, company_name, country, city, address, website, region, status, source, grade, rc_link, created_by, is_deleted, created_at, updated_at)
    values
      (v_cust1, 'Acme Imports', 'UAE', 'Dubai', 'SZR', 'https://acme.example.com', 'GCC', 'New', 'Web', 'A+', 'RC-1001', v_user, false, v_now, v_now),
      (v_cust2, 'Bright Retailers', 'UAE', 'Sharjah', 'Ind Area', 'https://bright.example.com', 'GCC', 'Renew', 'Referral', 'B+', 'RC-1002', v_user, false, v_now, v_now),
      (v_cust3, 'Canyon Logistics', 'UAE', 'Abu Dhabi', 'Port', 'https://canyon.example.com', 'GCC', 'Expire', 'Event', 'B', 'RC-1003', v_user, false, v_now, v_now),
      (v_cust4, 'Delta Traders', 'Pakistan', 'Lahore', 'MM Alam', 'https://delta.example.com', 'PK', 'New', 'Call', 'A-', 'RC-1004', v_user, false, v_now, v_now),
      (v_cust5, 'Everest Textiles', 'Pakistan', 'Karachi', 'KHI IX', 'https://everest.example.com', 'PK', 'New', 'Email', 'B+', 'RC-1005', v_user, false, v_now, v_now);
  else
    -- reuse existing ids to avoid duplicates
    select id into v_cust1 from customers where company_name = 'Acme Imports' and created_by = v_user limit 1;
    select id into v_cust2 from customers where company_name = 'Bright Retailers' and created_by = v_user limit 1;
    select id into v_cust3 from customers where company_name = 'Canyon Logistics' and created_by = v_user limit 1;
    select id into v_cust4 from customers where company_name = 'Delta Traders' and created_by = v_user limit 1;
    select id into v_cust5 from customers where company_name = 'Everest Textiles' and created_by = v_user limit 1;
  end if;

  -- Opportunities
  insert into opportunities (id, customer_id, title, stage, value, expected_close_date, owner_id, created_at, updated_at, is_deleted)
  values
    (gen_random_uuid(), v_cust1, 'AB Package', 'LD', 18000, v_today + 15, v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust2, 'Renewal Gold', 'PM', 12000, v_today + 20, v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust3, 'VAS Addon', 'BV', 6000, v_today + 30, v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust4, 'Starter Plan', 'QF', 4000, v_today + 10, v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust5, 'Sponsor Brand Deal', 'NC', 9000, v_today + 45, v_user, v_now, v_now, false)
  on conflict do nothing;

  -- Activities (use legacy columns: type/method + activity_date/created_by)
  insert into activities (id, customer_id, type, method, notes, activity_date, created_by, created_at, updated_at, is_deleted)
  values
    (gen_random_uuid(), v_cust1, 'mobile', 'mobile', 'Intro call', v_now - interval '1 day', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust2, 'whatsapp', 'whatsapp', 'Pricing shared', v_now - interval '2 day', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust3, 'onsite', 'onsite', 'Demo visit', v_now - interval '3 day', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust4, 'email', 'email', 'Proposal sent', v_now - interval '1 day', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust5, 'seminar', 'seminar', 'Webinar follow-up', v_now - interval '4 day', v_user, v_now, v_now, false)
  on conflict do nothing;

  -- Follow ups
  insert into follow_ups (id, customer_id, due_at, status, notes, assigned_to, created_at, updated_at, is_deleted)
  values
    (gen_random_uuid(), v_cust1, v_now + interval '1 day', 'Open', 'Call back tomorrow', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust2, v_now + interval '3 day', 'Open', 'Send renewal quote', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust3, v_now + interval '7 day', 'Completed', 'Awaiting documents', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust4, v_now + interval '2 day', 'Open', 'Schedule onsite', v_user, v_now, v_now, false),
    (gen_random_uuid(), v_cust5, v_now + interval '5 day', 'Open', 'Share sponsor deck', v_user, v_now, v_now, false)
  on conflict do nothing;

  -- Appointments for today
  insert into appointments (id, customer_id, starts_at, ends_at, location, notes, assigned_to, created_at, updated_at, is_deleted, user_id)
  values
    (gen_random_uuid(), v_cust1, v_today::timestamptz + time '11:00', v_today::timestamptz + time '11:30', 'Zoom', 'Demo walkthrough', v_user, v_now, v_now, false, v_user),
    (gen_random_uuid(), v_cust2, v_today::timestamptz + time '15:00', v_today::timestamptz + time '15:30', 'Office', 'Renewal discussion', v_user, v_now, v_now, false, v_user)
  on conflict do nothing;

  -- Targets (legacy columns)
  insert into targets (id, user_id, month, year, ab_target, vas_target, type, created_at, updated_at)
  values
    (gen_random_uuid(), v_user, extract(month from v_now)::int, extract(year from v_now)::int, 50000, 45000, 'AB', v_now, v_now),
    (gen_random_uuid(), v_user, extract(month from v_now)::int, extract(year from v_now)::int, 30000, 45000, 'VAS', v_now, v_now)
  on conflict do nothing;
end
$$;
