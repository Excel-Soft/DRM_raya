import type { Pool, PoolClient } from "pg";

const PLATFORM_URL_COLUMNS: { platform: string; column: string }[] = [
  { platform: "Facebook", column: "url_fb" },
  { platform: "Instagram", column: "insta_url" },
  { platform: "Linkedin", column: "linkedin_url" },
  { platform: "Youtube", column: "youtube_url" },
  { platform: "Tiktok", column: "tiktok_url" },
];

export type LegacyPlatformCell = {
  platform: string;
  postUrl: string | null;
  likes: string;
  shares: string;
  comments: string;
};

export type LegacyTodayPostSession = {
  id: string;
  entity: string;
  createdAt: string | null;
  dateKey: string;
  platforms: LegacyPlatformCell[];
  source: "legacy" | "modern";
};

function normalizeEntity(raw: unknown): string {
  const t = raw != null ? String(raw).trim() : "";
  if (!t) return "Unknown";
  if (t.toLowerCase() === "ceo") return "CEO";
  return t;
}

function toDateKey(value: unknown): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  const d = new Date(t.includes("T") ? t : t.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return t.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayMetric(value: unknown): string {
  if (value == null) return "0";
  const t = String(value).trim();
  if (!t || t.toLowerCase() === "no") return "0";
  if (/^\d+$/.test(t)) return t;
  return t;
}

function isNonemptyUrl(value: unknown): boolean {
  if (value == null) return false;
  const t = String(value).trim();
  return t.length > 0 && t !== "-" && t.toLowerCase() !== "null";
}

export async function legacyTodayPostAvailable(client: Pool | PoolClient): Promise<boolean> {
  const t = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_social_account_post'
    LIMIT 1
  `);
  return t.rows.length > 0;
}

async function loadFollowupMap(
  client: Pool | PoolClient,
  postIds: string[],
): Promise<Map<string, { likes: string; shares: string; comments: string }>> {
  const map = new Map<string, { likes: string; shares: string; comments: string }>();
  if (!postIds.length) return map;
  const { rows } = await client.query(
    `
    SELECT DISTINCT ON (post_id, plat_form)
      post_id,
      plat_form,
      likes,
      shares,
      comments
    FROM legacy_archive.webxl_social_post_followup
    WHERE post_id = ANY($1::text[])
    ORDER BY post_id, plat_form, NULLIF(create_at, '')::timestamp DESC NULLS LAST
    `,
    [postIds],
  );
  for (const row of rows) {
    const key = `${String(row.post_id)}::${String(row.plat_form)}`;
    map.set(key, {
      likes: displayMetric(row.likes),
      shares: displayMetric(row.shares),
      comments: displayMetric(row.comments),
    });
  }
  return map;
}

export async function fetchLegacyTodayPostSessions(
  client: Pool | PoolClient,
  opts: { start?: Date | null; end?: Date | null; limit?: number },
): Promise<LegacyTodayPostSession[]> {
  const available = await legacyTodayPostAvailable(client);
  if (!available) return [];

  const params: unknown[] = [];
  const where: string[] = [`NULLIF(btrim(p.create_at), '') IS NOT NULL`];
  if (opts.start) {
    params.push(opts.start);
    where.push(`NULLIF(p.create_at, '')::timestamp >= $${params.length}`);
  }
  if (opts.end) {
    params.push(opts.end);
    where.push(`NULLIF(p.create_at, '')::timestamp <= $${params.length}`);
  }
  const limit = Math.min(Math.max(opts.limit ?? 500, 1), 2000);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await client.query(
    `
    SELECT
      p.id,
      p.account_type,
      p.create_at,
      p.url_fb,
      p.insta_url,
      p.linkedin_url,
      p.youtube_url,
      p.tiktok_url
    FROM legacy_archive.webxl_social_account_post p
    ${whereSql}
    ORDER BY NULLIF(p.create_at, '')::timestamp DESC NULLS LAST, NULLIF(p.id, '')::bigint DESC NULLS LAST
    LIMIT ${limit}
    `,
    params,
  );

  const postIds = rows.map((r) => String(r.id));
  const followup = await loadFollowupMap(client, postIds);

  const sessions: LegacyTodayPostSession[] = [];
  for (const row of rows) {
    const id = String(row.id);
    const dateKey = toDateKey(row.create_at) ?? "unknown";
    const platforms: LegacyPlatformCell[] = PLATFORM_URL_COLUMNS.map(({ platform, column }) => {
      const postUrl = isNonemptyUrl(row[column]) ? String(row[column]).trim() : null;
      const stats = followup.get(`${id}::${platform}`) ?? { likes: "0", shares: "0", comments: "0" };
      return { platform, postUrl, ...stats };
    });
    sessions.push({
      id,
      entity: normalizeEntity(row.account_type),
      createdAt: row.create_at ? String(row.create_at).trim() : null,
      dateKey,
      platforms,
      source: "legacy",
    });
  }
  return sessions;
}
