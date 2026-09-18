import { pool } from "../db";
import type { PoolClient } from "pg";

export const ASSET_TYPES = ["Laptop", "Mobile", "LED", "Desktop", "Tablet", "Other"] as const;
export const ASSET_CONDITIONS = ["In Use", "In Custody", "Damaged"] as const;
export const PROJECT_TYPES = ["New Project", "Renewal"] as const;

export interface PhysicalAssetDTO {
  id: string;
  assetType: string;
  projectType: string | null;
  makeModel: string | null;
  colour: string | null;
  purchaseDate: string | null;
  warranty: string | null;
  warrantyPeriod: string | null;
  purchasedCondition: string | null;
  currentCondition: string;
  empCode: string | null;
  issuedStatus: string | null;
  employeeName: string | null;
  branchId: string | null;
  branchName: string | null;
  specification: string | null;
  assetOwnedBy: string | null;
  mobilePhone: string | null;
  itManagerRemarks: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: any): PhysicalAssetDTO {
  return {
    id: row.id,
    assetType: row.asset_type,
    projectType: row.project_type ?? null,
    makeModel: row.make_model ?? null,
    colour: row.colour ?? null,
    purchaseDate: row.purchase_date ?? null,
    warranty: row.warranty ?? null,
    warrantyPeriod: row.warranty_period ?? null,
    purchasedCondition: row.purchased_condition ?? null,
    currentCondition: row.current_condition,
    empCode: row.emp_code ?? null,
    issuedStatus: row.issued_status ?? null,
    employeeName: row.employee_name ?? null,
    branchId: row.branch_id ?? null,
    branchName: row.branch_name ?? null,
    specification: row.specification ?? null,
    assetOwnedBy: row.asset_owned_by ?? null,
    mobilePhone: row.mobile_phone ?? null,
    itManagerRemarks: row.it_manager_remarks ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface PhysicalAssetInput {
  assetType: string;
  projectType?: string | null;
  makeModel?: string | null;
  colour?: string | null;
  purchaseDate?: string | null;
  warranty?: string | null;
  warrantyPeriod?: string | null;
  purchasedCondition?: string | null;
  currentCondition?: string;
  empCode?: string | null;
  issuedStatus?: string | null;
  employeeName?: string | null;
  branchId?: string | null;
  specification?: string | null;
  assetOwnedBy?: string | null;
  mobilePhone?: string | null;
  itManagerRemarks?: string | null;
}

export interface AssetListFilters {
  branchId?: string;
  assetType?: string;
  condition?: string;
}

export interface AssetStats {
  overview: { totalAssets: number; inUse: number; inCustody: number; damaged: number };
  distribution: Array<{ assetType: string; count: number }>;
  branches: Array<{ branchId: string; branchName: string; count: number }>;
  allOfficesCount: number;
  projectTypes: { newProject: number; renewal: number };
}

const SELECT_COLUMNS = `
  pa.id, pa.asset_type, pa.project_type, pa.make_model, pa.colour, pa.purchase_date, pa.warranty,
  pa.warranty_period, pa.purchased_condition, pa.current_condition, pa.emp_code,
  pa.issued_status, pa.employee_name, pa.branch_id, b.name AS branch_name,
  pa.specification, pa.asset_owned_by, pa.mobile_phone, pa.it_manager_remarks,
  pa.created_at, pa.updated_at
`;

class PhysicalAssetsRepository {
  async list(filters: AssetListFilters = {}): Promise<PhysicalAssetDTO[]> {
    const where: string[] = ["pa.deleted_at IS NULL"];
    const params: any[] = [];
    let i = 1;
    if (filters.branchId) { where.push(`pa.branch_id = $${i++}`); params.push(filters.branchId); }
    if (filters.assetType) { where.push(`pa.asset_type = $${i++}`); params.push(filters.assetType); }
    if (filters.condition) { where.push(`pa.current_condition = $${i++}`); params.push(filters.condition); }

    const { rows } = await pool.query(
      `SELECT ${SELECT_COLUMNS}
       FROM drm.physical_assets pa
       LEFT JOIN drm.branches b ON b.id = pa.branch_id
       WHERE ${where.join(" AND ")}
       ORDER BY pa.created_at DESC
       LIMIT 2000`,
      params,
    );
    return rows.map(mapRow);
  }

  async findById(id: string): Promise<PhysicalAssetDTO | null> {
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLUMNS}
       FROM drm.physical_assets pa
       LEFT JOIN drm.branches b ON b.id = pa.branch_id
       WHERE pa.id = $1 AND pa.deleted_at IS NULL`,
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async getStats(): Promise<AssetStats> {
    const [overviewRes, distributionRes, branchesRes] = await Promise.all([
      pool.query(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE current_condition = 'In Use')::int AS in_use,
          count(*) FILTER (WHERE current_condition = 'In Custody')::int AS in_custody,
          count(*) FILTER (WHERE current_condition = 'Damaged')::int AS damaged,
          count(*) FILTER (WHERE project_type = 'New Project')::int AS new_project,
          count(*) FILTER (WHERE project_type = 'Renewal')::int AS renewal
        FROM drm.physical_assets WHERE deleted_at IS NULL
      `),
      pool.query(`
        SELECT coalesce(asset_type, 'Other') AS asset_type, count(*)::int AS count
        FROM drm.physical_assets WHERE deleted_at IS NULL
        GROUP BY asset_type
      `),
      pool.query(`
        SELECT b.id AS branch_id, b.name AS branch_name,
               count(pa.id) FILTER (WHERE pa.deleted_at IS NULL)::int AS count
        FROM drm.branches b
        LEFT JOIN drm.physical_assets pa ON pa.branch_id = b.id
        WHERE b.deleted_at IS NULL AND b.is_active = true
        GROUP BY b.id, b.name
        ORDER BY b.sort_order ASC, b.name ASC
      `),
    ]);

    const o = overviewRes.rows[0] || {};
    return {
      overview: {
        totalAssets: Number(o.total ?? 0),
        inUse: Number(o.in_use ?? 0),
        inCustody: Number(o.in_custody ?? 0),
        damaged: Number(o.damaged ?? 0),
      },
      distribution: distributionRes.rows.map((r) => ({ assetType: r.asset_type, count: Number(r.count) })),
      branches: branchesRes.rows.map((r) => ({
        branchId: r.branch_id,
        branchName: r.branch_name,
        count: Number(r.count),
      })),
      allOfficesCount: Number(o.total ?? 0),
      projectTypes: {
        newProject: Number(o.new_project ?? 0),
        renewal: Number(o.renewal ?? 0),
      },
    };
  }

  async create(data: PhysicalAssetInput, userId: string | null): Promise<PhysicalAssetDTO> {
    const { rows } = await pool.query(
      `INSERT INTO drm.physical_assets (
        asset_type, project_type, make_model, colour, purchase_date, warranty, warranty_period,
        purchased_condition, current_condition, emp_code, issued_status, employee_name,
        branch_id, specification, asset_owned_by, mobile_phone, it_manager_remarks,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'In Custody'),$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)
      RETURNING id`,
      [
        data.assetType, data.projectType ?? null, data.makeModel ?? null, data.colour ?? null, data.purchaseDate ?? null,
        data.warranty ?? null, data.warrantyPeriod ?? null, data.purchasedCondition ?? null,
        data.currentCondition ?? null, data.empCode ?? null, data.issuedStatus ?? null,
        data.employeeName ?? null, data.branchId ?? null, data.specification ?? null,
        data.assetOwnedBy ?? null, data.mobilePhone ?? null, data.itManagerRemarks ?? null,
        userId,
      ],
    );
    return (await this.findById(rows[0].id))!;
  }

  async update(id: string, data: Partial<PhysicalAssetInput>, userId: string | null): Promise<PhysicalAssetDTO | null> {
    const colMap: Record<string, string> = {
      assetType: "asset_type", projectType: "project_type", makeModel: "make_model", colour: "colour", purchaseDate: "purchase_date",
      warranty: "warranty", warrantyPeriod: "warranty_period", purchasedCondition: "purchased_condition",
      currentCondition: "current_condition", empCode: "emp_code", issuedStatus: "issued_status",
      employeeName: "employee_name", branchId: "branch_id", specification: "specification",
      assetOwnedBy: "asset_owned_by", mobilePhone: "mobile_phone", itManagerRemarks: "it_manager_remarks",
    };
    const fields: string[] = [];
    const params: any[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(colMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${col} = $${i++}`);
        params.push((data as any)[key]);
      }
    }
    fields.push(`updated_by = $${i++}`); params.push(userId);
    fields.push(`updated_at = now()`);

    if (fields.length === 2) return this.findById(id);

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE drm.physical_assets SET ${fields.join(", ")} WHERE id = $${i} AND deleted_at IS NULL RETURNING id`,
      params,
    );
    return rows[0] ? this.findById(rows[0].id) : null;
  }

  async softDelete(id: string, userId: string | null): Promise<boolean> {
    const { rowCount } = await pool.query(
      `UPDATE drm.physical_assets SET deleted_at = now(), updated_by = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async bulkInsert(
    rowsData: PhysicalAssetInput[],
    userId: string | null,
  ): Promise<{ imported: number }> {
    if (rowsData.length === 0) return { imported: 0 };
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const data of rowsData) {
        await client.query(
          `INSERT INTO drm.physical_assets (
            asset_type, project_type, make_model, colour, purchase_date, warranty, warranty_period,
            purchased_condition, current_condition, emp_code, issued_status, employee_name,
            branch_id, specification, asset_owned_by, mobile_phone, it_manager_remarks,
            created_by, updated_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'In Custody'),$10,$11,$12,$13,$14,$15,$16,$17,$18,$18)`,
          [
            data.assetType, data.projectType ?? null, data.makeModel ?? null, data.colour ?? null, data.purchaseDate ?? null,
            data.warranty ?? null, data.warrantyPeriod ?? null, data.purchasedCondition ?? null,
            data.currentCondition ?? null, data.empCode ?? null, data.issuedStatus ?? null,
            data.employeeName ?? null, data.branchId ?? null, data.specification ?? null,
            data.assetOwnedBy ?? null, data.mobilePhone ?? null, data.itManagerRemarks ?? null,
            userId,
          ],
        );
      }
      await client.query("COMMIT");
      return { imported: rowsData.length };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

export const physicalAssetsRepository = new PhysicalAssetsRepository();
