import { db, pool } from "../db";
import { users, type User, type InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

let usersSchemaEnsured = false;

async function ensureUsersSchema() {
  if (usersSchemaEnsured) return;
  usersSchemaEnsured = true;

  const alterSql = `
    alter table drm.users
      add column if not exists username text,
      add column if not exists name text,
      add column if not exists password text,
      add column if not exists role_id text,
      add column if not exists branch text,
      add column if not exists country text,
      add column if not exists is_active boolean default true,
      add column if not exists created_at timestamptz default now(),
      add column if not exists roles text[],
      add column if not exists full_name text,
      add column if not exists first_name text,
      add column if not exists father_husband_name text,
      add column if not exists attendance_id text,
      add column if not exists guardian_mobile text,
      add column if not exists passport_cnic text,
      add column if not exists facebook_id text,
      add column if not exists date_of_birth text,
      add column if not exists join_date text,
      add column if not exists role_type text,
      add column if not exists under_works text,
      add column if not exists basic_salary text,
      add column if not exists daily_allowance text,
      add column if not exists mobile_allowance text,
      add column if not exists admin_allowance text,
      add column if not exists conveyance_allowance text,
      add column if not exists relaxation_minutes text,
      add column if not exists increment text,
      add column if not exists gender text,
      add column if not exists address text,
      add column if not exists role text,
      add column if not exists password_hash text,
      add column if not exists updated_at timestamptz default now();

    update drm.users set
      username = coalesce(username, email),
      name = coalesce(name, username, email),
      password = coalesce(password, ''),
      role_id = coalesce(role_id, 'sales_executive'),
      roles = case when roles is null and role_id is not null then array[role_id] else roles end,
      branch = coalesce(branch, 'HQ'),
      country = coalesce(country, 'UAE'),
      is_active = coalesce(is_active, true),
      created_at = coalesce(created_at, now());

    alter table drm.users
      add column if not exists department text,
      add column if not exists designation text,
      add column if not exists phone text;

    create table if not exists drm.user_groups (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      description text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists drm.user_group_members (
      group_id uuid references drm.user_groups(id) on delete cascade,
      user_id uuid references drm.users(id) on delete cascade,
      joined_at timestamptz default now(),
      primary key (group_id, user_id)
    );
  `;

  try {
    await pool.query(alterSql);
  } catch (err) {
    console.error("Failed to ensure users schema (continuing):", err);
  }
}

export class UsersRepository {
  async findByEmail(email: string): Promise<User | undefined> {
    await ensureUsersSchema();
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async findById(id: string): Promise<User | undefined> {
    await ensureUsersSchema();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async create(user: InsertUser): Promise<User> {
    await ensureUsersSchema();
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async findAll(): Promise<User[]> {
    await ensureUsersSchema();
    const res = await pool.query("select * from drm.users where is_active = true or is_active is null order by created_at desc");
    return res.rows as any[];
  }

  async findByRole(role: string): Promise<User | undefined> {
    await ensureUsersSchema();
    // Try both role_id and role columns
    const res = await pool.query(
      "select * from drm.users where (role_id = $1 or role = $1) and is_active = true limit 1",
      [role]
    );
    return res.rows[0];
  }
}

export const usersRepository = new UsersRepository();
