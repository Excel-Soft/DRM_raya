import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    await db.execute(sql`DROP TABLE IF EXISTS cheques CASCADE;`);
    await db.execute(sql`
      CREATE TABLE cheques (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cheque_number TEXT NOT NULL,
        bank_name TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'PKR',
        company_name TEXT NOT NULL,
        cheque_date TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pending',
        notes TEXT,
        created_by_user_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Cheques table recreated!');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}
run();
