/**
 * Patch 5 — GM/Sales workflow configuration service.
 *
 * Owns the `drm.gm_sales_workflow_config` key/value table. The table is created
 * and seeded idempotently at runtime (CREATE TABLE IF NOT EXISTS +
 * INSERT ... ON CONFLICT DO NOTHING) because repo-wide `db:push` is broken and
 * because existing config values must never be overwritten by a redeploy.
 *
 * `getConfig()` returns the EFFECTIVE config: stored rows merged on top of the
 * safe defaults, so a newly-added key is always present even before it is seeded.
 */
import { pool } from "../db";
import {
  GM_SALES_CONFIG_DEFAULTS,
  GM_SALES_CONFIG_KEY_DESCRIPTIONS,
  gmSalesConfigPatchSchema,
  type GmSalesConfig,
  type GmSalesConfigKey,
} from "../../shared/gm-sales-constants";

const TABLE = "drm.gm_sales_workflow_config";

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

  for (const key of Object.keys(GM_SALES_CONFIG_DEFAULTS) as GmSalesConfigKey[]) {
    await pool.query(
      `INSERT INTO ${TABLE} (key, value, description)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO NOTHING`,
      [
        key,
        JSON.stringify(GM_SALES_CONFIG_DEFAULTS[key]),
        GM_SALES_CONFIG_KEY_DESCRIPTIONS[key] ?? null,
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
  config: GmSalesConfig;
  meta: ConfigMetaRow[];
}

/** Return the effective config (defaults overlaid with stored values) + metadata. */
export async function getConfig(): Promise<EffectiveConfig> {
  await ensureConfigTable();
  const { rows } = await pool.query(
    `SELECT key, value, updated_by, updated_at FROM ${TABLE}`,
  );

  const config: GmSalesConfig = { ...GM_SALES_CONFIG_DEFAULTS };
  const meta: ConfigMetaRow[] = [];

  for (const row of rows) {
    const key = row.key as GmSalesConfigKey;
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
export async function getConfigValue<K extends GmSalesConfigKey>(
  key: K,
): Promise<GmSalesConfig[K]> {
  const { config } = await getConfig();
  return config[key];
}

export interface PatchConfigResult {
  updatedKeys: string[];
  config: GmSalesConfig;
}

/**
 * Validate and apply a partial config update. Returns the new effective config.
 * Throws a ZodError if validation fails (caller maps it to a 400 envelope).
 */
export async function patchConfig(
  updates: unknown,
  updatedBy: string | undefined,
): Promise<PatchConfigResult> {
  const parsed = gmSalesConfigPatchSchema.parse(updates);
  await ensureConfigTable();

  const updatedKeys = Object.keys(parsed) as GmSalesConfigKey[];
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
        JSON.stringify(parsed[key]),
        GM_SALES_CONFIG_KEY_DESCRIPTIONS[key] ?? null,
        updatedBy ?? null,
      ],
    );
  }

  const { config } = await getConfig();
  return { updatedKeys, config };
}
