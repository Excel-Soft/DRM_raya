import { pool } from "../db";

const sqlQueries = `
DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_customers" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_targets" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_activities" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_followups" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_complaints" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_dropouts" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE IF EXISTS "public"."service_renewals" SET SCHEMA "drm";
EXCEPTION WHEN OTHERS THEN null; END $$;
`;

async function run() {
  await pool.query(sqlQueries);
  console.log("Moved tables to drm schema!");
  process.exit(0);
}

run();
