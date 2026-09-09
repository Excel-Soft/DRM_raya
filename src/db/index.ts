import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

function loadEnvFile(): void {
  if (process.env.DATABASE_URL) return;

  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const buffer = fs.readFileSync(envPath);
  let contents: string;

  // UTF-16LE (common in Windows editors)
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    contents = buffer.toString("utf16le");
  } else {
    contents = buffer.toString("utf8");
    // Strip UTF-8 BOM if present
    if (contents.charCodeAt(0) === 0xfeff) {
      contents = contents.slice(1);
    }
  }

  const parsed = dotenv.parse(contents);
  for (const [key, value] of Object.entries(parsed)) {
    const existingValue = process.env[key];
    if (existingValue !== undefined && existingValue !== "") continue;
    process.env[key] = value;
  }
}

function resolveSsl(connectionString: string): pg.PoolConfig["ssl"] {
  if (process.env.DATABASE_SSL === "true") {
    return { rejectUnauthorized: false };
  }

  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode && sslmode !== "disable") {
      return { rejectUnauthorized: false };
    }
  } catch {
    // ignore invalid DATABASE_URL
  }

  return false;
}

loadEnvFile();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set (in .env or process env).");
}

export const pool = new Pool({
  connectionString,
  ssl: resolveSsl(connectionString),
});

export const db = drizzle(pool, { schema });
export { schema };

