import { pool } from "../db";

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): Branch {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface BranchInput {
  name: string;
  code?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

class BranchesRepository {
  async list(includeInactive: boolean): Promise<Branch[]> {
    const where = includeInactive ? "deleted_at IS NULL" : "deleted_at IS NULL AND is_active = true";
    const { rows } = await pool.query(
      `SELECT id, name, code, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.branches
       WHERE ${where}
       ORDER BY sort_order ASC, name ASC`,
    );
    return rows.map(mapRow);
  }

  async findByName(name: string): Promise<Branch | null> {
    const { rows } = await pool.query(
      `SELECT id, name, code, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.branches
       WHERE deleted_at IS NULL AND lower(name) = lower($1)
       LIMIT 1`,
      [name],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(data: BranchInput, userId: string | null): Promise<Branch> {
    const { rows } = await pool.query(
      `INSERT INTO drm.branches (name, code, is_active, sort_order, created_by, updated_by)
       VALUES ($1, $2, COALESCE($3, true), COALESCE($4, 0), $5, $5)
       RETURNING id, name, code, is_active, sort_order, created_by, updated_by, created_at, updated_at`,
      [data.name.trim(), data.code?.trim() || null, data.isActive, data.sortOrder, userId],
    );
    return mapRow(rows[0]);
  }

  async update(id: string, data: Partial<BranchInput>, userId: string | null): Promise<Branch | null> {
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (data.name !== undefined) { fields.push(`name = $${i++}`); params.push(data.name.trim()); }
    if (data.code !== undefined) { fields.push(`code = $${i++}`); params.push(data.code?.trim() || null); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${i++}`); params.push(data.isActive); }
    if (data.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); params.push(data.sortOrder); }
    fields.push(`updated_by = $${i++}`); params.push(userId);
    fields.push(`updated_at = now()`);

    if (fields.length === 0) return this.findById(id);

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE drm.branches SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, name, code, is_active, sort_order, created_by, updated_by, created_at, updated_at`,
      params,
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async findById(id: string): Promise<Branch | null> {
    const { rows } = await pool.query(
      `SELECT id, name, code, is_active, sort_order, created_by, updated_by, created_at, updated_at
       FROM drm.branches WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async softDelete(id: string, userId: string | null): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE drm.branches SET deleted_at = now(), updated_by = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }
}

export const branchesRepository = new BranchesRepository();
