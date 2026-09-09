/**
 * Patch 6 Stage 5 — Service-bridge configuration service.
 *
 * Owns the `drm.service_bridge_config` key/value table. Created + seeded
 * idempotently at runtime (CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT
 * DO NOTHING) because repo-wide `db:push` is broken and stored values must
 * survive redeploys. Mirrors `gm-sales-config.service.ts`.
 *
 * `getConfig()` returns the EFFECTIVE config: safe defaults (all `false`)
 * overlaid with stored rows, so a newly-added key is always present even before
 * it is seeded.
 */
import { pool } from "../db";
import {
  SERVICE_BRIDGE_CONFIG_DEFAULTS,
  SERVICE_BRIDGE_CONFIG_KEY_DESCRIPTIONS,
  serviceBridgeConfigPatchSchema,
  type ServiceBridgeConfig,
  type ServiceBridgeConfigKey,
} from "../../shared/service-bridge-constants";

const TABLE = "drm.service_bridge_config";

let ensured = false;

/** Create + seed the config table. Idempotent. Existing values are preserved. */
export async function ensureConfigTable(): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      description TEXT,
      updated_by VARCHAR,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const key of Object.keys(
    SERVICE_BRIDGE_CONFIG_DEFAULTS,
  ) as ServiceBridgeConfigKey[]) {
    await pool.query(
      `INSERT INTO ${TABLE} (key, value, description)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO NOTHING`,
      [
        key,
        JSON.stringify(SERVICE_BRIDGE_CONFIG_DEFAULTS[key]),
        SERVICE_BRIDGE_CONFIG_KEY_DESCRIPTIONS[key] ?? null,
      ],
    );
  }
  ensured = true;
}

export interface ConfigMetaRow {
  key: string;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface EffectiveConfig {
  config: ServiceBridgeConfig;
  meta: ConfigMetaRow[];
}

/** Return the effective config (defaults overlaid with stored values) + metadata. */
export async function getConfig(): Promise<EffectiveConfig> {
  await ensureConfigTable();
  const { rows } = await pool.query(
    `SELECT key, value, updated_by, updated_at FROM ${TABLE}`,
  );

  const config: ServiceBridgeConfig = { ...SERVICE_BRIDGE_CONFIG_DEFAULTS };
  const meta: ConfigMetaRow[] = [];

  for (const row of rows) {
    const key = row.key as ServiceBridgeConfigKey;
    if (key in config) {
      // pg returns jsonb already parsed
      (config as Record<string, unknown>)[key] = row.value;
    }
    meta.push({
      key: row.key,
      updatedBy: row.updated_by ?? null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    });
  }

  return { config, meta };
}

/** Read a single effective config value. */
export async function getConfigValue<K extends ServiceBridgeConfigKey>(
  key: K,
): Promise<ServiceBridgeConfig[K]> {
  const { config } = await getConfig();
  return config[key];
}

export interface PatchConfigResult {
  updatedKeys: string[];
  config: ServiceBridgeConfig;
}

/**
 * Validate and apply a partial config update. Returns the new effective config.
 * Throws a ZodError if validation fails (caller maps it to a 400 envelope).
 */
export async function patchConfig(
  updates: unknown,
  updatedBy: string | undefined,
): Promise<PatchConfigResult> {
  const parsed = serviceBridgeConfigPatchSchema.parse(updates);
  await ensureConfigTable();

  const updatedKeys = Object.keys(parsed) as ServiceBridgeConfigKey[];
  for (const key of updatedKeys) {
    await pool.query(
      `INSERT INTO ${TABLE} (key, value, description, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, $4, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
      [
        key,
        JSON.stringify((parsed as Record<string, unknown>)[key]),
        SERVICE_BRIDGE_CONFIG_KEY_DESCRIPTIONS[key] ?? null,
        updatedBy ?? null,
      ],
    );
  }

  const { config } = await getConfig();
  return { updatedKeys, config };
}
