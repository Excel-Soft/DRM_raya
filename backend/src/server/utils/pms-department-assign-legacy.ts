import type { Pool, PoolClient } from "pg";

export type PmsDepartmentAssignment = {
  id: string;
  name: string;
  ratio: string;
  managerIds: string[];
  managers: { id: string; name: string }[];
};

export type PmsAssignUserOption = {
  id: string;
  name: string;
};

function trimName(name: string | null | undefined): string {
  return String(name ?? "").replace(/\s+/g, " ").trim();
}

async function archiveReady(client: Pool | PoolClient): Promise<boolean> {
  const res = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'legacy_archive' AND table_name = 'webxl_department'
    LIMIT 1
  `);
  return res.rows.length > 0;
}

async function resolveLegacyUserNames(
  client: Pool | PoolClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(userIds.map((x) => String(x).trim()).filter(Boolean))];
  if (!ids.length) return map;

  const res = await client.query(
    `SELECT user_id, name FROM legacy_archive.webxl_user WHERE user_id = ANY($1::text[])`,
    [ids],
  );
  for (const row of res.rows) {
    const id = String(row.user_id).trim();
    map.set(id, trimName(row.name) || id);
  }
  return map;
}

export async function listPmsDepartmentAssignments(
  client: Pool | PoolClient,
): Promise<{ departments: PmsDepartmentAssignment[]; users: PmsAssignUserOption[] }> {
  if (!(await archiveReady(client))) {
    return { departments: [], users: [] };
  }

  const deptRes = await client.query(`
    SELECT id, name, pms_managers, pms_ratio
    FROM legacy_archive.webxl_department
    ORDER BY NULLIF(id, '')::int ASC NULLS LAST, id ASC
  `);

  const allManagerIds: string[] = [];
  const parsed = deptRes.rows.map((row) => {
    const id = String(row.id).trim();
    const name = trimName(row.name);
    const ratioRaw = trimName(row.pms_ratio);
    const ratio = ratioRaw || "0:0";
    const managerIds = String(row.pms_managers ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    allManagerIds.push(...managerIds);
    return { id, name, ratio, managerIds };
  });

  const nameMap = await resolveLegacyUserNames(client, allManagerIds);

  const departments: PmsDepartmentAssignment[] = parsed.map((d) => ({
    id: d.id,
    name: d.name,
    ratio: d.ratio,
    managerIds: d.managerIds,
    managers: d.managerIds.map((mid) => ({
      id: mid,
      name: nameMap.get(mid) ?? mid,
    })),
  }));

  const usersRes = await client.query(`
    SELECT user_id, name
    FROM legacy_archive.webxl_user
    WHERE user_id IS NOT NULL AND btrim(user_id) <> ''
    ORDER BY btrim(name) ASC NULLS LAST, user_id ASC
    LIMIT 2000
  `);

  const users: PmsAssignUserOption[] = usersRes.rows.map((row) => ({
    id: String(row.user_id).trim(),
    name: trimName(row.name) || String(row.user_id),
  }));

  return { departments, users };
}

export async function savePmsDepartmentAssignment(
  client: Pool | PoolClient,
  input: { departmentId: string; userIds: string[]; ratio: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!(await archiveReady(client))) {
    return { ok: false, error: "Legacy department archive not available" };
  }

  const departmentId = String(input.departmentId).trim();
  if (!departmentId) return { ok: false, error: "Department id required" };

  const ratio = trimName(input.ratio) || "0:0";
  const userIds = [...new Set((input.userIds ?? []).map((x) => String(x).trim()).filter(Boolean))];
  const pmsManagers = userIds.join(",");

  const result = await client.query(
    `UPDATE legacy_archive.webxl_department
     SET pms_managers = $1, pms_ratio = $2
     WHERE id = $3`,
    [pmsManagers, ratio, departmentId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return { ok: false, error: "Department not found" };
  }
  return { ok: true };
}
