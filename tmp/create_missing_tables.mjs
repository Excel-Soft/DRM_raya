import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function run() {
  try {
    console.log('Creating dollar_buyers and dollar_buying tables...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drm.dollar_buyers (
        id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        reference text,
        paypal_email text,
        account_no text,
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS drm.dollar_buying (
        id varchar(50) PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_id varchar(50) REFERENCES drm.dollar_buyers(id),
        buyer_name text,
        buyer_reference text,
        paypal_email text,
        account_no text,
        cheque_id text,
        payment_method text,
        type text,
        dollar_amount numeric(12,2) NOT NULL,
        dollar_rate numeric(12,2) NOT NULL,
        pkr_amount numeric(12,2) NOT NULL,
        date timestamp DEFAULT now(),
        screenshot_url text,
        detail text,
        martini text DEFAULT 'Show',
        created_by_user_id varchar(50),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    console.log('Tables created successfully.');
  } catch (err) {
    console.error('Creation failed', err);
  } finally {
    await pool.end();
  }
}

run();
