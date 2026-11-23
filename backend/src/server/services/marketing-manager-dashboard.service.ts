import { pool } from "../db";

export type MarketingEventRow = {
  id: string;
  name: string;
  eventType: string | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  amount: number;
  attendeeCount: number;
  speakers: Array<{ speakerName?: string | null }>;
  isLegacy?: boolean;
};

export type MarketingLeadRow = {
  id: string;
  companyName: string;
  createdBy: string;
  createdAt: string | null;
  country: string | null;
  status: string;
};

function toDateOnly(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function periodStart(period: string): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const p = (period || "ld").toLowerCase();
  if (p === "wc") d.setDate(d.getDate() - 6);
  else if (p === "mc") d.setDate(d.getDate() - 29);
  else if (p === "qc") d.setDate(d.getDate() - 89);
  else if (p === "yc") d.setDate(d.getDate() - 364);
  return d;
}

const SPEAKERS_SUBQUERY = `
  COALESCE((
    SELECT json_agg(json_build_object('speakerName', s.speaker_name) ORDER BY s.created_at)
    FROM drm.event_speakers s WHERE s.event_id = e.id
  ), '[]'::json) AS speakers
`;

const LEGACY_EVENTS_SELECT = `
  SELECT
    'legacy-' || le.id AS id,
    le.name,
    COALESCE(att.name, le.event_type) AS event_type,
    le.event_date::date AS event_date,
    NULLIF(left(le.start_time, 5), '') AS start_time,
    NULLIF(left(le.end_time, 5), '') AS end_time,
    NULLIF(btrim(le.venu, E' \\t\\r\\n'), '') AS venue,
    CASE WHEN btrim(le.amount) ~ '^[0-9]+(\\.[0-9]+)?$' THEN btrim(le.amount)::numeric ELSE 0 END AS amount,
    CASE WHEN btrim(le.attending) ~ '^[0-9]+$' THEN btrim(le.attending)::int ELSE 0 END AS attendee_count,
    true AS is_legacy,
    COALESCE((
      SELECT json_agg(json_build_object('speakerName', ls.speaker) ORDER BY ls.id::int)
      FROM legacy_archive.webxl_event_speaker ls WHERE ls.event_name = le.id
    ), '[]'::json) AS speakers
  FROM legacy_archive.webxl_event le
  LEFT JOIN legacy_archive.webxl_attribute att ON att.id = le.event_type AND att."refId" = '9'
  WHERE le.event_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND le.event_date NOT LIKE '0000%'
    AND NOT EXISTS (
      SELECT 1 FROM migration_meta.migration_legacy_ids m
      JOIN drm.events me ON me.id::text = m.modern_id
      WHERE m.legacy_table = 'webxl_event' AND m.legacy_id = le.id
    )
`;

const MODERN_EVENTS_SELECT = `
  SELECT
    e.id::text AS id, e.name, e.event_type, e.event_date, e.start_time, e.end_time,
    e.venue, e.amount, e.attendee_count, false AS is_legacy,
    ${SPEAKERS_SUBQUERY}
  FROM drm.events e
  WHERE e.deleted_at IS NULL
`;

export async function fetchMarketingDashboardEvents(period: string): Promise<{
  events: MarketingEventRow[];
  stats: {
    totalEvents: number;
    seminar: number;
    webinar: number;
    attending: number;
    eventCost: number;
    nextEventDate: string | null;
    nextEventName: string | null;
  };
}> {
  const { rows } = await pool.query(
    `
    SELECT * FROM (
      ${MODERN_EVENTS_SELECT}
      UNION ALL
      ${LEGACY_EVENTS_SELECT}
    ) e
    ORDER BY event_date DESC NULLS LAST, id DESC
    LIMIT 500
    `,
  );

  const mapRow = (r: any): MarketingEventRow => ({
    id: String(r.id),
    name: r.name,
    eventType: r.event_type ?? null,
    eventDate: toDateOnly(r.event_date),
    startTime: r.start_time ?? null,
    endTime: r.end_time ?? null,
    venue: r.venue ?? null,
    amount: Number(r.amount ?? 0),
    attendeeCount: Number(r.attendee_count ?? 0),
    speakers: Array.isArray(r.speakers) ? r.speakers : [],
    isLegacy: r.is_legacy === true,
  });

  const events = rows.map(mapRow);
  const start = periodStart(period);
  const periodEvents = events.filter((e) => e.eventDate && new Date(e.eventDate) >= start);

  const attendingRes = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM drm.event_attendees WHERE lower(btrim(attendance_status)) = 'present'`,
  );
  const attendingLegacy = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM legacy_archive.webxl_event_history WHERE btrim(atten) = 'Present'`,
  );
  const attending =
    Number(attendingRes.rows[0]?.count ?? 0) + Number(attendingLegacy.rows[0]?.count ?? 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = events
    .filter((e) => e.eventDate && new Date(e.eventDate) >= today)
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())[0];

  const normType = (t: string | null) => (t || "").toLowerCase();
  return {
    events,
    stats: {
      totalEvents: periodEvents.length,
      seminar: periodEvents.filter((e) => normType(e.eventType).includes("seminar")).length,
      webinar: periodEvents.filter((e) => normType(e.eventType).includes("webinar")).length,
      attending,
      eventCost: periodEvents.reduce((s, e) => s + e.amount, 0),
      nextEventDate: next?.eventDate ?? null,
      nextEventName: next?.name ?? null,
    },
  };
}

export async function fetchMarketingUploadedLeads(
  page: number,
  limit: number,
  userId?: string | null,
): Promise<{ rows: MarketingLeadRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const params: unknown[] = [];
  let ownerFilter = "";
  if (userId) {
    params.push(userId);
    ownerFilter = `AND o.owner_id = $${params.length}::uuid`;
  }

  const countRes = await pool.query<{ count: string }>(
    `
    SELECT count(*)::text AS count
    FROM drm.opportunities o
    WHERE coalesce(o.is_deleted, false) = false
      ${ownerFilter}
    `,
    params,
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const listParams = [...params, limit, offset];
  const { rows } = await pool.query<{
    id: string;
    company_name: string | null;
    owner_name: string | null;
    created_at: Date;
    country: string | null;
    stage: string | null;
  }>(
    `
    SELECT
      o.id::text,
      COALESCE(NULLIF(btrim(c.company_name), ''), NULLIF(btrim(c.account_name), ''), 'UNKNOWN') AS company_name,
      COALESCE(NULLIF(btrim(ou.full_name), ''), NULLIF(btrim(ou.name), ''), '-') AS owner_name,
      o.created_at,
      NULLIF(btrim(c.country), '') AS country,
      o.stage
    FROM drm.opportunities o
    LEFT JOIN drm.customers c ON c.id = o.customer_id
    LEFT JOIN drm.users ou ON ou.id = o.owner_id
    WHERE coalesce(o.is_deleted, false) = false
      ${ownerFilter}
    ORDER BY o.created_at DESC NULLS LAST
    LIMIT $${listParams.length - 1} OFFSET $${listParams.length}
    `,
    listParams,
  );

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      companyName: r.company_name || "UNKNOWN",
      createdBy: r.owner_name || "-",
      createdAt: r.created_at ? r.created_at.toISOString() : null,
      country: r.country,
      status: r.stage || "Lead",
    })),
  };
}