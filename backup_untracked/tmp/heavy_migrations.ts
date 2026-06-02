import { pool } from "../server/db";

async function main() {
    console.log("Running heavy schema migrations...");

    const sql = `
    alter table customers
      add column if not exists company text,
      add column if not exists account_holder text,
      add column if not exists company_id text,
      add column if not exists company_name text,
      add column if not exists account_name text,
      add column if not exists email text,
      add column if not exists phone text,
      add column if not exists phone_normalized text,
      add column if not exists region text,
      add column if not exists grade text default 'C',
      add column if not exists status text default 'New',
      add column if not exists ntn text,
      add column if not exists last_note text,
      add column if not exists service_types text[] default '{}'::text[],
      add column if not exists source text,
      add column if not exists owner_user_id uuid,
      add column if not exists created_by uuid,
      add column if not exists company_type text,
      add column if not exists person_name text,
      add column if not exists designation text,
      add column if not exists rc_link text,
      add column if not exists business_line text,
      add column if not exists pool_type text default 'Private',
      add column if not exists title text,
      add column if not exists comment text,
      add column if not exists mobile text,
      add column if not exists cnic text,
      add column if not exists crm_id text,
      add column if not exists crm_date timestamptz,
      add column if not exists last_followup_date timestamptz,
      add column if not exists expires_at timestamptz,
      add column if not exists is_gold_member integer default 0,
      add column if not exists is_business_verified integer default 0,
      add column if not exists ab_type text,
      add column if not exists drm_id text,
      add column if not exists created_at timestamptz default now(),
      add column if not exists updated_at timestamptz default now();

    do $$ begin
      create unique index if not exists idx_customers_company_name_unique on customers (lower(trim(company_name)));
    exception when others then raise notice 'Could not create company_name unique index: %', sqlerrm; end $$;

    do $$ begin
      create unique index if not exists idx_customers_email_unique on customers (lower(trim(email)));
    exception when others then raise notice 'Could not create email unique index: %', sqlerrm; end $$;

    update customers set
      company_name = coalesce(company_name, company),
      account_name = coalesce(account_name, account_holder),
      company_id = coalesce(company_id, id::text),
      email = coalesce(email, ''),
      phone = coalesce(phone, ''),
      region = coalesce(region, ''),
      grade = coalesce(grade, 'C'),
      status = coalesce(status, 'New'),
      last_note = coalesce(last_note, ''),
      created_at = coalesce(created_at, now()),
      updated_at = coalesce(updated_at, now());

    alter table follow_ups
      add column if not exists date_time timestamptz,
      add column if not exists method text,
      add column if not exists created_by uuid,
      add column if not exists reservation_type text,
      add column if not exists talk_time_seconds int not null default 0;
    `;

    try {
        await pool.query(sql);
        console.log("OK: Heavy schema migrations completed.");
    } catch (err: any) {
        console.log("ERROR:", err.message);
    }

    process.exit(0);
}
main();
