import type { Pool } from "pg";

let ensured = false;

export async function ensureAllowedIpUserColumns(pool: Pool): Promise<void> {
  if (ensured) return;
  await pool.query(`ALTER TABLE drm.allowed_ips ADD COLUMN IF NOT EXISTS user_id uuid`);
  await pool.query(`ALTER TABLE drm.allowed_ips ADD COLUMN IF NOT EXISTS user_name text`);

  const archiveExists = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_drm_allowed_ip'
    LIMIT 1
  `);
  if (archiveExists.rows.length) {
    await pool.query(`
      UPDATE drm.allowed_ips a
      SET user_name = NULLIF(btrim(l.ip_user), '')
      FROM legacy_archive.webxl_drm_allowed_ip l
      WHERE btrim(coalesce(l.allowed_ip, '')) = btrim(a.ip_cidr)
        AND coalesce(btrim(l.ip_user), '') <> ''
        AND coalesce(btrim(a.user_name), '') = ''
    `);
  }
  ensured = true;
}
