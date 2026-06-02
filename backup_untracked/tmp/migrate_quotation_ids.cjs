const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log("Starting quotation table ID migration...");
    await pool.query(`
    -- First, drop the check constraint for discount_type to allow PERCENTAGE if needed
    do $$ 
    begin 
      if exists (select 1 from information_schema.table_constraints where table_name='quotations' and constraint_name like 'quotations_discount_type_check%') then
        alter table drm.quotations drop constraint quotations_discount_type_check;
      end if;
    exception when others then null; end $$;

    -- Update column types for flexibility
    alter table drm.quotations alter column customer_id type text;
    alter table drm.quotations alter column lead_id type text;
    alter table drm.quotations alter column created_by type text;
    
    -- Ensure indexes still work (usually they do after cast, but good to check)
  `);
    console.log("Migration finished.");
    process.exit(0);
}

main().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
