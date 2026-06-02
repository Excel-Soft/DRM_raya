-- Seed realistic sales data for the first user to make Sales Executive Dashboard show real values
do $$
declare
  v_user uuid;
  v_today date := current_date;
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  c4 uuid := gen_random_uuid();
  c5 uuid := gen_random_uuid();
begin
  -- pick the earliest user as the sales exec
  select id into v_user from users order by created_at asc limit 1;
  if v_user is null then
    raise notice 'No users found, skipping seed';
    return;
  end if;

  -- customers
  insert into customers (id, company_name, region, grade, status, source, created_by, owner_user_id, pool_type, expires_at, created_at, updated_at)
  values
    (c1, 'Alpha Imports', 'GCC', 'A', 'New', 'Web', v_user, v_user, 'Private', v_today + 12, now(), now()),
    (c2, 'Beta Retail', 'PK', 'B', 'Renew', 'Referral', v_user, v_user, 'Private', v_today + 18, now(), now()),
    (c3, 'Gamma Logistics', 'UAE', 'B', 'New', 'Email', v_user, null, 'Public', v_today + 6, now(), now()),
    (c4, 'Delta Textiles', 'UAE', 'A', 'Expire', 'Call', v_user, null, 'Service', v_today + 25, now(), now()),
    (c5, 'Epsilon Brands', 'GCC', 'A', 'New', 'Event', v_user, v_user, 'Private', v_today + 9, now(), now())
  on conflict do nothing;

  -- opportunities for KPIs and target calc
  insert into opportunities (id, customer_id, title, stage, value, expected_close_date, owner_id, created_at, updated_at, is_deleted)
  values
    (gen_random_uuid(), c1, 'VAS Package', 'PM', 12000, v_today + 10, v_user, now() - interval '5 day', now(), false),
    (gen_random_uuid(), c2, 'AB Renewal', 'RC', 18000, v_today + 20, v_user, now() - interval '15 day', now(), false),
    (gen_random_uuid(), c3, 'PSA Kickoff', 'LD', 8000, v_today + 5, v_user, now() - interval '3 day', now(), false),
    (gen_random_uuid(), c4, 'Sponsor Brand', 'NC', 6000, v_today + 12, v_user, now() - interval '8 day', now(), false),
    (gen_random_uuid(), c5, 'KWA Plan', 'QF', 9000, v_today + 30, v_user, now() - interval '1 day', now(), false)
  on conflict do nothing;

  -- activities for time spent per method
  insert into activities (id, customer_id, type, method, notes, activity_date, created_by, created_at, updated_at, is_deleted)
  values
    (gen_random_uuid(), c1, 'mobile', 'mobile', 'Intro call', now() - interval '4 day', v_user, now(), now(), false),
    (gen_random_uuid(), c2, 'whatsapp', 'whatsapp', 'Pricing shared', now() - interval '2 day', v_user, now(), now(), false),
    (gen_random_uuid(), c3, 'onsite', 'onsite', 'Demo visit', now() - interval '1 day', v_user, now(), now(), false),
    (gen_random_uuid(), c4, 'email', 'email', 'Proposal sent', now() - interval '6 day', v_user, now(), now(), false),
    (gen_random_uuid(), c5, 'seminar', 'seminar', 'Webinar follow-up', now() - interval '7 day', v_user, now(), now(), false)
  on conflict do nothing;

  -- follow ups for Important counts
  insert into follow_ups (id, customer_id, due_at, status, notes, assigned_to, created_at, updated_at, is_deleted)
  values
    (gen_random_uuid(), c1, now() + interval '1 day', 'Open', 'Call back tomorrow', v_user, now(), now(), false),
    (gen_random_uuid(), c2, now() + interval '3 day', 'Open', 'Send renewal quote', v_user, now(), now(), false),
    (gen_random_uuid(), c3, now() + interval '7 day', 'Completed', 'Awaiting docs', v_user, now(), now(), false)
  on conflict do nothing;

  -- appointments for today card
  insert into appointments (id, customer_id, starts_at, ends_at, location, notes, assigned_to, created_at, updated_at, is_deleted, user_id)
  values
    (gen_random_uuid(), c1, v_today::timestamptz + time '11:00', v_today::timestamptz + time '11:30', 'Zoom', 'Demo', v_user, now(), now(), false, v_user),
    (gen_random_uuid(), c2, v_today::timestamptz + time '15:00', v_today::timestamptz + time '15:30', 'Office', 'Renewal discussion', v_user, now(), now(), false, v_user)
  on conflict do nothing;

  -- targets for current month
  insert into targets (id, user_id, month, year, ab_target, vas_target, type, created_at, updated_at)
  values
    (gen_random_uuid(), v_user, extract(month from now())::int, extract(year from now())::int, 50000, 45000, 'VAS', now(), now())
  on conflict do nothing;
end
$$;
