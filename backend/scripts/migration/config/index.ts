import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const fileEnv = parseEnvFile(resolve(here, "migration.env"));
const env = { ...fileEnv, ...process.env };

export function getMigrationConfig() {
  const url = env.MIGRATION_DATABASE_URL ?? "";
  if (!url.includes("drm_legacy_stage")) {
    throw new Error("MIGRATION_DATABASE_URL must target drm_legacy_stage only");
  }
  return {
    databaseUrl: url,
    mysqlDumpPath: env.MYSQL_DUMP_PATH ?? "/var/www/DRM_raya/old_drm_database.sql",
    sourceDatabaseName: env.SOURCE_DATABASE_NAME ?? "ndrm",
    batchSize: Number(env.BATCH_SIZE ?? "500"),
    maxRetries: Number(env.MAX_RETRIES ?? "3"),
    dryRun: (env.DRY_RUN ?? "true").toLowerCase() === "true",
  };
}
