import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config();

const url = new URL(process.env.DATABASE_URL!);
const database = url.pathname.replace(/^\//, "");

export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        host: url.hostname,
        port: url.port ? Number(url.port) : 5432,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database,
        ssl: { rejectUnauthorized: false },
    },
    strict: true,
    verbose: true,
});
