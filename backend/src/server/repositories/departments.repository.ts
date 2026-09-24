import { pool } from "../db";

export interface Department {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): Department {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DepartmentInput {
  code: string;
  name: string;
  isActive?: boolean;
  sortOrder?: number;
}

class DepartmentsRepository {
  async list(includeInactive: boolean): Promise<Department[]> {
    const where = includeInactive ? "deleted_at IS NULL" : "deleted_at IS NULL AND is_active = true";
    const { rows } = await pool.query(
      `SELECT id, code, name, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.departments
       WHERE ${where}
       ORDER BY sort_order ASC, name ASC`,
    );
    return rows.map(mapRow);
  }

  async findByName(name: string): Promise<Department | null> {
    const { rows } = await pool.query(
      `SELECT id, code, name, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.departments
       WHERE deleted_at IS NULL AND lower(name) = lower($1)
       LIMIT 1`,
      [name],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findByCode(code: string): Promise<Department | null> {
    const { rows } = await pool.query(
      `SELECT id, code, name, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.departments
       WHERE deleted_at IS NULL AND lower(code) = lower($1)
       LIMIT 1`,
      [code],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(data: DepartmentInput, userId: string | null): Promise<Department> {
    const { rows } = await pool.query(
      `INSERT INTO drm.departments (code, name, is_active, sort_order, created_by, updated_by)
       VALUES ($1, $2, COALESCE($3, true), COALESCE($4, 0), $5, $5)
       RETURNING id, code, name, is_active, sort_order, created_by, updated_by, created_at, updated_at`,
      [data.code.trim(), data.name.trim(), data.isActive, data.sortOrder, userId],
    );
    return mapRow(rows[0]);
  }

  async update(id: string, data: Partial<DepartmentInput>, userId: string | null): Promise<Department | null> {
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (data.code !== undefined) { fields.push(`code = $${i++}`); params.push(data.code.trim()); }
    if (data.name !== undefined) { fields.push(`name = $${i++}`); params.push(data.name.trim()); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${i++}`); params.push(data.isActive); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); params.push(data.sortOrder); }
    fields.push(`updated_by = $${i++}`); params.push(userId);
    fields.push(`updated_at = now()`);

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE drm.departments SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, code, name, is_active, sort_order, created_by, updated_by, created_at, updated_at`,
      params,
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findById(id: string): Promise<Department | null> {
    const { rows } = await pool.query(
      `SELECT id, code, name, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.departments WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async softDelete(id: string, userId: string | null): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE drm.departments SET deleted_at = now(), updated_by = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  /** Count of service catalog rows (any of the 3 levels) still referencing this code, as either an Allowed Department or the Project Department. */
  async countServiceReferences(code: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM drm.services WHERE route_departments @> ARRAY[$1]::text[] OR project_department = $1) +
         (SELECT count(*) FROM drm.service_subservices WHERE route_departments @> ARRAY[$1]::text[] OR project_department = $1) +
         (SELECT count(*) FROM drm.service_sub_subservices WHERE route_departments @> ARRAY[$1]::text[] OR project_department = $1)
         AS total`,
      [code],
    );
    return Number(rows[0]?.total ?? 0);
  }
}

export const departmentsRepository = new DepartmentsRepository();
