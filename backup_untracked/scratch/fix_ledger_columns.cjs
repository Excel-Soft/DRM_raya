const { Client } = require('pg');
require('dotenv').config();

async function fix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log("Connected to database");

        // 1. Create enum if not exists
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'ledger_entry_type' AND n.nspname = 'drm') THEN
                    CREATE TYPE drm.ledger_entry_type AS ENUM ('Credit', 'Debit');
                END IF;
            END $$;
        `);
        console.log("Enum checked/created");

        // 2. Ensure table exists in drm schema
        await client.query(`
            CREATE TABLE IF NOT EXISTS drm.ledger_entries (
                id varchar(255) primary key default gen_random_uuid(),
                entry_type drm.ledger_entry_type not null default 'Credit',
                amount numeric(12,2) not null,
                currency text not null default 'USD',
                description text not null,
                category text not null,
                date timestamptz not null default now(),
                reference_id varchar(255),
                reference_type text,
                balance_after numeric(12,2),
                entry_date timestamptz not null default now(),
                created_by_user_id uuid,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now()
            );
        `);
        console.log("Table checked/created in drm schema");

        // 3. Ensure entry_type column exists
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='drm' AND table_name='ledger_entries' AND column_name='entry_type') THEN
                    ALTER TABLE drm.ledger_entries ADD COLUMN entry_type drm.ledger_entry_type NOT NULL DEFAULT 'Credit';
                END IF;
            END $$;
        `);
        console.log("entry_type column checked/created");

        // 4. Ensure entry_date column exists (mentioned in Postgres hint)
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='drm' AND table_name='ledger_entries' AND column_name='entry_date') THEN
                    ALTER TABLE drm.ledger_entries ADD COLUMN entry_date timestamptz NOT NULL DEFAULT now();
                END IF;
            END $$;
        `);
        console.log("entry_date column checked/created");

    } catch (err) {
        console.error("Fix failed:", err);
    } finally {
        await client.end();
    }
}

fix();
