import { pool } from "../server/db";

async function main() {
    console.log("Fixing tasks and task_time_logs columns...");

    const sql = `
    -- Fix tasks table
    alter table tasks add column if not exists status text default 'ToDo';
    alter table tasks add column if not exists owner_user_id uuid;
    alter table tasks add column if not exists assigned_to_user_id uuid;
    alter table tasks add column if not exists created_by uuid;
    
    -- Fix projects table
    alter table projects add column if not exists owner_user_id uuid;
    alter table projects add column if not exists created_by uuid;

    -- Fix task_time_logs table
    create table if not exists task_time_logs (
        id varchar(255) primary key default gen_random_uuid(),
        task_id varchar(255) not null,
        user_id varchar(255) not null,
        time_spent_minutes integer not null,
        description text,
        log_date timestamp default now(),
        created_at timestamp default now()
    );
    alter table task_time_logs add column if not exists time_spent_minutes integer;
    `;

    try {
        await pool.query(sql);
        console.log("OK: Columns and tables ensured.");
    } catch (err: any) {
        console.log("ERROR:", err.message);
    }

    process.exit(0);
}
main();
