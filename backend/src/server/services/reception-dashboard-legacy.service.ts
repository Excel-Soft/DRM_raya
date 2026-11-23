import { pool } from "../db";

export type ReceptionListRow = {
  id: string;
  company: string;
  meeting: string;
  service?: string | null;
  time: string | null;
  lastContact: string | null;
  visitDate?: string | null;
  source: "modern" | "legacy";
  companyId?: string | null;
  legacyComId?: string | null;
  legacyUserId?: string | null;
  canStart: boolean;
};

function safeTs(col: string): string {
  return `
    CASE
      WHEN ${col} IS NULL OR btrim(${col}::text) = '' OR ${col}::text LIKE '0000-%'
      THEN NULL
      ELSE (${col}::timestamp AT TIME ZONE 'Asia/Karachi')
    END
  `;
}

const todayKarachi = `(NOW() AT TIME ZONE 'Asia/Karachi')::date`;

export async function countExpectedClientsToday(): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `
    WITH legacy AS (
      SELECT lf._legacy_pk AS id
      FROM legacy_archive.webxl_last_followup lf
      WHERE (
        (${safeTs("lf.create_date")})::date = ${todayKarachi}
        OR (${safeTs("lf.nc")})::date = ${todayKarachi}
      )
    ),
    modern AS (
      SELECT m.id::text
      FROM drm.meetings m
      WHERE m.status = 'expected'
        AND (m.meeting_date AT TIME ZONE 'Asia/Karachi')::date = ${todayKarachi}
    )
    SELECT count(*)::text AS count FROM (
      SELECT id FROM legacy
      UNION
      SELECT id FROM modern
    ) u
    `,
  );
  return Number(rows[0]?.count ?? 0);
}

export async function fetchExpectedClients(page: number, limit: number): Promise<{ rows: ReceptionListRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const countRes = await pool.query<{ count: string }>(
    `
    WITH combined AS (
      SELECT lf._legacy_pk AS id
      FROM legacy_archive.webxl_last_followup lf
      WHERE (
        (${safeTs("lf.create_date")})::date = ${todayKarachi}
        OR (${safeTs("lf.nc")})::date = ${todayKarachi}
      )
      UNION ALL
      SELECT m.id::text
      FROM drm.meetings m
      WHERE m.status = 'expected'
        AND (m.meeting_date AT TIME ZONE 'Asia/Karachi')::date = ${todayKarachi}
    )
    SELECT count(DISTINCT id)::text AS count FROM combined
    `,
  );
  const total = Number(countRes.rows[0]?.count ?? 0);

  const { rows } = await pool.query<{
    id: string;
    company: string;
    meeting: string;
    time: Date | null;
    last_contact: Date | null;
    source: string;
    company_id: string | null;
    legacy_com_id: string | null;
    legacy_user_id: string | null;
    can_start: boolean;
  }>(
    `
    WITH legacy_rows AS (
      SELECT
        'lf-' || lf._legacy_pk AS id,
        COALESCE(
          NULLIF(btrim(cust.company_name), ''),
          NULLIF(btrim(co.cname), ''),
          'UNKNOWN'
        ) AS company,
        COALESCE(NULLIF(btrim(lf.username), ''), '-') AS meeting,
        ${safeTs("lf.nc")} AS time,
        ${safeTs("lf.create_date")} AS last_contact,
        'legacy'::text AS source,
        cust.id::text AS company_id,
        NULLIF(btrim(lf.com_id::text), '') AS legacy_com_id,
        NULLIF(btrim(lf.uid::text), '') AS legacy_user_id,
        true AS can_start
      FROM legacy_archive.webxl_last_followup lf
      LEFT JOIN legacy_archive.webxl_company co ON co.id = lf.com_id
      LEFT JOIN migration_meta.migration_legacy_ids mi
        ON mi.entity_type = 'customer'
       AND mi.legacy_table = 'webxl_company'
       AND mi.legacy_id = NULLIF(btrim(lf.com_id::text), '')
      LEFT JOIN drm.customers cust ON cust.id = mi.modern_id::uuid
      WHERE (
        (${safeTs("lf.create_date")})::date = ${todayKarachi}
        OR (${safeTs("lf.nc")})::date = ${todayKarachi}
      )
    ),
    modern_rows AS (
      SELECT
        m.id::text AS id,
        COALESCE(
          NULLIF(btrim(c.company_name), ''),
          NULLIF(btrim(m.person_name), ''),
          'UNKNOWN'
        ) AS company,
        COALESCE(NULLIF(btrim(m.person_name), ''), '-') AS meeting,
        COALESCE(m.scheduled_time, m.meeting_date) AS time,
        m.meeting_date AS last_contact,
        'modern'::text AS source,
        m.company_id::text AS company_id,
        NULL::text AS legacy_com_id,
        NULL::text AS legacy_user_id,
        true AS can_start
      FROM drm.meetings m
      LEFT JOIN drm.customers c ON c.id = m.company_id
      WHERE m.status = 'expected'
        AND (m.meeting_date AT TIME ZONE 'Asia/Karachi')::date = ${todayKarachi}
    ),
    combined AS (
      SELECT * FROM legacy_rows
      UNION ALL
      SELECT * FROM modern_rows
    )
    SELECT * FROM combined
    ORDER BY COALESCE(time, last_contact) DESC NULLS LAST, id DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      company: r.company,
      meeting: r.meeting,
      time: r.time ? new Date(r.time).toISOString() : null,
      lastContact: r.last_contact ? new Date(r.last_contact).toISOString() : null,
      source: r.source === "legacy" ? "legacy" : "modern",
      companyId: r.company_id,
      legacyComId: r.legacy_com_id,
      legacyUserId: r.legacy_user_id,
      canStart: r.can_start,
    })),
  };
}

export async function fetchMonthlyVisits(page: number, limit: number): Promise<{ rows: ReceptionListRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const { rows: countRows } = await pool.query<{ count: string }>(
    `
    SELECT count(*)::text AS count
    FROM drm.meetings m
    WHERE m.status = 'ended'
      AND m.start_time IS NOT NULL
      AND m.start_time > (NOW() AT TIME ZONE 'Asia/Karachi') - INTERVAL '1 month'
    `,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const { rows } = await pool.query<{
    id: string;
    company: string;
    service: string | null;
    meeting: string;
    time: Date;
    visit_date: Date;
  }>(
    `
    SELECT
      m.id::text AS id,
      COALESCE(NULLIF(btrim(c.company_name), ''), NULLIF(btrim(m.person_name), ''), 'UNKNOWN') AS company,
      COALESCE(NULLIF(btrim(m.meeting_type), ''), '-') AS service,
      COALESCE(NULLIF(btrim(m.person_name), ''), '-') AS meeting,
      m.start_time AS time,
      m.start_time AS visit_date
    FROM drm.meetings m
    LEFT JOIN drm.customers c ON c.id = m.company_id
    WHERE m.status = 'ended'
      AND m.start_time IS NOT NULL
      AND m.start_time > (NOW() AT TIME ZONE 'Asia/Karachi') - INTERVAL '1 month'
    ORDER BY m.start_time DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      company: r.company,
      meeting: r.meeting,
      service: r.service,
      time: r.time ? new Date(r.time).toISOString() : null,
      lastContact: null,
      visitDate: r.visit_date ? new Date(r.visit_date).toISOString() : null,
      source: "modern" as const,
      canStart: false,
    })),
  };
}

export async function fetchEventAttendance(page: number, limit: number): Promise<{ rows: ReceptionListRow[]; total: number }> {
  const offset = (page - 1) * limit;
  const todayKarachiDate = todayKarachi;

  // Legacy reception listed Absent rows for events still open (event_date >= today).
  // Most environments have no future-dated events, so we still return all Absent
  // attendees (migrated into drm.event_attendees) and sort upcoming events first.
  const { rows: countRows } = await pool.query<{ count: string }>(
    `
    SELECT count(*)::text AS count
    FROM drm.event_attendees a
    JOIN drm.events e ON e.id = a.event_id
    WHERE e.deleted_at IS NULL
      AND lower(btrim(coalesce(a.attendance_status, ''))) = 'absent'
    `,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const { rows } = await pool.query<{
    id: string;
    company: string;
    meeting: string;
    service: string | null;
    time: Date | null;
    last_contact: Date | null;
    is_upcoming: boolean;
  }>(
    `
    SELECT
      a.id::text AS id,
      COALESCE(NULLIF(btrim(c.company_name), ''), 'UNKNOWN') AS company,
      COALESCE(NULLIF(btrim(e.name), ''), '-') AS meeting,
      COALESCE(
        NULLIF(btrim(u.full_name), ''),
        NULLIF(btrim(u.name), ''),
        NULLIF(btrim(lu.name), ''),
        '-'
      ) AS service,
      a.created_at AS time,
      a.created_at AS last_contact,
      (e.event_date >= ${todayKarachiDate}) AS is_upcoming
    FROM drm.event_attendees a
    JOIN drm.events e ON e.id = a.event_id
    LEFT JOIN drm.customers c ON c.id = a.customer_id
    LEFT JOIN drm.users u ON u.id = a.created_by
    LEFT JOIN migration_meta.migration_legacy_ids miu
      ON miu.entity_type = 'event_attendee'
     AND miu.modern_table = 'event_attendees'
     AND miu.modern_id = a.id::text
    LEFT JOIN legacy_archive.webxl_event_history h
      ON h._source_table = 'webxl_event_history'
     AND h._legacy_pk = miu.legacy_id
    LEFT JOIN legacy_archive.webxl_user lu ON lu.user_id = h.user_id
    WHERE e.deleted_at IS NULL
      AND lower(btrim(coalesce(a.attendance_status, ''))) = 'absent'
    ORDER BY
      CASE WHEN e.event_date >= ${todayKarachiDate} THEN 0 ELSE 1 END,
      e.event_date DESC,
      a.created_at DESC NULLS LAST
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      company: r.company,
      meeting: r.meeting,
      service: r.service,
      time: r.time ? new Date(r.time).toISOString() : null,
      lastContact: r.last_contact ? new Date(r.last_contact).toISOString() : null,
      source: "modern" as const,
      canStart: r.is_upcoming,
    })),
  };
}