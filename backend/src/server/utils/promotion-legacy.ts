import type { Pool, PoolClient } from "pg";

const DEFAULT_LEGACY_PROMOTION_BASE =
  "https://webexcels.pk/drm/assets/images/promotions/";

export function legacyPromotionBannerUrl(img: string | null | undefined): string | null {
  if (!img || !String(img).trim()) return null;
  const raw = String(img).trim();
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const base = (process.env.LEGACY_PROMOTION_ASSET_BASE || DEFAULT_LEGACY_PROMOTION_BASE).replace(
    /\/?$/,
    "/",
  );
  const parts = raw.split("/").map((p) => encodeURIComponent(p));
  return base + parts.join("/");
}

function parseLegacyDate(value: string | null | undefined): string | null {
  if (!value || !String(value).trim()) return null;
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function ensurePromotionLegacyColumns(client: PoolClient | Pool): Promise<void> {
  await client.query(`ALTER TABLE drm.promotions ADD COLUMN IF NOT EXISTS legacy_source_id text`);
  await client.query(`ALTER TABLE drm.promotions ADD COLUMN IF NOT EXISTS sort_rank integer`);
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_legacy_source_id
     ON drm.promotions (legacy_source_id) WHERE legacy_source_id IS NOT NULL`,
  );
}

/** One-time import from legacy_archive.webxl_promotions when the modern table is empty. */
export async function seedPromotionsFromLegacyIfEmpty(client: PoolClient | Pool): Promise<number> {
  await ensurePromotionLegacyColumns(client);

  const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM drm.promotions WHERE deleted_at IS NULL`);
  if ((countRes.rows[0]?.n ?? 0) > 0) return 0;

  const archiveExists = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_promotions'
    LIMIT 1
  `);
  if (!archiveExists.rows.length) return 0;

  const { rows } = await client.query(`
    SELECT id, package, title, img, discount, start_date, end_date, detail, active, rank
    FROM legacy_archive.webxl_promotions
    ORDER BY NULLIF(rank, '')::int ASC NULLS LAST, id::int ASC NULLS LAST, id ASC
  `);

  let inserted = 0;
  for (const row of rows) {
    const legacyId = String(row.id);
    const title = String(row.title || "").trim();
    if (!title) continue;

    const isActive = String(row.active || "active").toLowerCase() === "active";
    const discountRaw = row.discount != null ? String(row.discount).trim() : "";
    const discount = discountRaw !== "" ? discountRaw : null;
    const packageName = row.package ? String(row.package).trim() || null : null;
    const subTitle = row.detail ? String(row.detail).trim() || null : null;
    const bannerUrl = legacyPromotionBannerUrl(row.img);
    const sortRank =
      row.rank != null && String(row.rank).trim() !== "" ? parseInt(String(row.rank), 10) : null;

    await client.query(
      `INSERT INTO drm.promotions (
          package_name, title, sub_title, discount, banner_url, media_type,
          start_date, end_date, is_active, status, legacy_source_id, sort_rank
       ) VALUES ($1,$2,$3,$4,$5,'image',$6,$7,$8,'approved',$9,$10)`,
      [
        packageName,
        title,
        subTitle,
        discount,
        bannerUrl,
        parseLegacyDate(row.start_date),
        parseLegacyDate(row.end_date),
        isActive,
        legacyId,
        Number.isFinite(sortRank) ? sortRank : null,
      ],
    );
    inserted += 1;
  }

  return inserted;
}

/**
 * Move one promotion to a new 1-based rank; other rows shift like the legacy DRM UI
 * (e.g. rank 1 → 2 pushes former 2→3, 3→4, then renumbers 1..n with no gaps).
 */
export async function reorderPromotionRank(
  client: PoolClient | Pool,
  promotionId: string,
  newRank: number,
): Promise<void> {
  const db = client;
  const useTx = "release" in client;
  if (useTx) await (client as PoolClient).query("BEGIN");
  try {
    const { rows } = await db.query(`
      SELECT id, sort_rank
      FROM drm.promotions
      WHERE deleted_at IS NULL
      ORDER BY sort_rank ASC NULLS LAST, created_at ASC, id ASC
    `);
    if (!rows.length) return;

    const ordered = rows.map((r, idx) => ({
      id: String(r.id),
    }));
    const fromIdx = ordered.findIndex((r) => r.id === promotionId);
    if (fromIdx === -1) throw new Error("Promotion not found");

    const n = ordered.length;
    const target = Math.min(Math.max(Math.floor(newRank), 1), n);
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(target - 1, 0, moved);

    for (let i = 0; i < ordered.length; i++) {
      await db.query(
        `UPDATE drm.promotions SET sort_rank = $1, updated_at = now() WHERE id::text = $2::text`,
        [i + 1, ordered[i].id],
      );
    }
    if (useTx) await (client as PoolClient).query("COMMIT");
  } catch (e) {
    if (useTx) await (client as PoolClient).query("ROLLBACK");
    throw e;
  }
}
