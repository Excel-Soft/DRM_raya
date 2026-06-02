/**
 * Seed sample data for the Sales Executive dashboard.
 * Usage:
 *   DATABASE_URL=... SEED_USER_ID=<user_uuid> node scripts/seed-sales-exec.cjs
 */
require("dotenv").config();
const { Client } = require("pg");

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URI;

if (!databaseUrl) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) for seeding.");
  process.exit(1);
}

const userId = process.env.SEED_USER_ID;
if (!userId) {
  console.error("Set SEED_USER_ID to the logged-in sales executive user id.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

async function ensureCustomer() {
  const company = "Demo Corp - Sales Exec";
  const found = await client.query("select id from customers where company_name = $1 limit 1", [company]);
  if (found.rows[0]) return found.rows[0].id;

  const res = await client.query(
    `
      insert into customers
        (id, company_name, account_name, email, phone, region, grade, status, created_by, owner_user_id, created_at, updated_at)
      values
        (gen_random_uuid(), $1, $2, $3, $4, 'UAE', 'B+', 'New', $5, $5, now(), now())
      returning id
    `,
    [company, "Demo Account", "demo@sales-exec.local", "03001234567", userId],
  );
  return res.rows[0].id;
}

async function seed() {
  await client.connect();
  const customerId = await ensureCustomer();

  // Opportunity
  await client.query(
    `
      insert into opportunities (id, customer_id, owner_id, title, stage, value, expected_close_date, is_deleted, created_at, updated_at)
      values (gen_random_uuid(), $1, $2, 'Demo Deal', 'LD', 12000, current_date + 10, false, now(), now())
      on conflict do nothing
    `,
    [customerId, userId],
  );

  // Activities (mobile + whatsapp)
  await client.query(
    `
      insert into activities (id, customer_id, type, notes, activity_date, created_by, created_at, updated_at, is_deleted, method)
      values
        (gen_random_uuid(), $1, 'mobile', 'Initial call', now() - interval '1 hour', $2, now(), now(), false, 'mobile'),
        (gen_random_uuid(), $1, 'whatsapp', 'Sent intro message', now() - interval '30 minutes', $2, now(), now(), false, 'whatsapp')
      on conflict do nothing
    `,
    [customerId, userId],
  );

  // Follow up
  await client.query(
    `
      insert into follow_ups (id, customer_id, due_at, status, notes, assigned_to, created_at, updated_at, is_deleted, date_time)
      values (gen_random_uuid(), $1, now() + interval '2 days', 'Open', 'Demo follow-up', $2, now(), now(), false, now())
      on conflict do nothing
    `,
    [customerId, userId],
  );

  // Appointment (today)
  await client.query(
    `
      insert into appointments (id, customer_id, starts_at, ends_at, location, notes, assigned_to, created_at, updated_at, is_deleted, user_id)
      values (
        gen_random_uuid(), $1,
        now() + interval '1 hour',
        now() + interval '2 hour',
        'Online',
        'Demo meeting',
        $2,
        now(),
        now(),
        false,
        $2
      )
      on conflict do nothing
    `,
    [customerId, userId],
  );

  console.log("Seeded demo data for user:", userId, "customer:", customerId);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed", err);
  process.exit(1);
});
