import { pool } from "../db";

/**
 * Service BV/VAS document repository.
 *
 * NOTE (document storage limitation): the platform has no file-storage
 * infrastructure wired for the service department, so documents are stored as
 * attachment metadata (name + URL) rather than uploaded binaries. Callers pass
 * an externally hosted URL. This is the "support attachment URL/name fields
 * first" path from the Stage 5 spec.
 *
 * Table is created idempotently here (matching the service_pool_entries pattern)
 * to avoid a drizzle migration against the imported schema.
 */
export type ServiceDocType = "BV" | "VAS";

export interface DocumentListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  docType?: ServiceDocType;
  verificationStatus?: string;
  userIds?: string[] | null;
}

export class ServiceDocumentsRepository {
  async ensureTable() {
    const ddl = `
      CREATE TABLE IF NOT EXISTS drm.service_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id uuid REFERENCES drm.customers(id) ON DELETE SET NULL,
        service_customer_id uuid,
        doc_type text NOT NULL,
        name text NOT NULL,
        url text,
        package_name text,
        verification_status text NOT NULL DEFAULT 'pending',
        due_date timestamptz,
        remarks text,
        uploaded_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
        created_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
        updated_by uuid REFERENCES drm.users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_service_documents_type ON drm.service_documents(doc_type);
      CREATE INDEX IF NOT EXISTS idx_service_documents_customer ON drm.service_documents(customer_id);
      CREATE INDEX IF NOT EXISTS idx_service_documents_status ON drm.service_documents(verification_status);
    `;
    try {
      await pool.query(ddl);
    } catch (err) {
      console.error("Failed ensuring service_documents table:", err);
    }
  }

  async list(opts: DocumentListOptions) {
    const page = Math.max(1, Number(opts.page) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(opts.pageSize) || 25));
    const offset = (page - 1) * pageSize;
    const where: string[] = ["1=1"];
    const params: any[] = [];
    let p = 1;

    if (opts.docType) {
      where.push(`d.doc_type = $${p++}`);
      params.push(opts.docType);
    }
    if (opts.verificationStatus) {
      where.push(`d.verification_status = $${p++}`);
      params.push(opts.verificationStatus);
    }
    if (opts.search) {
      where.push(`(c.company_name ILIKE $${p} OR d.name ILIKE $${p} OR d.package_name ILIKE $${p})`);
      params.push(`%${opts.search}%`);
      p++;
    }
    if (opts.userIds && opts.userIds.length > 0) {
      where.push(`d.uploaded_by = ANY($${p++})`);
      params.push(opts.userIds);
    }
    const whereSql = where.join(" AND ");
    const base = `
      FROM drm.service_documents d
      LEFT JOIN drm.customers c ON c.id = d.customer_id
      LEFT JOIN drm.users u ON u.id = d.uploaded_by
      WHERE ${whereSql}
    `;
    const dataQuery = `
      SELECT
        d.id AS "id",
        d.customer_id AS "customerId",
        c.company_name AS "companyName",
        c.person_name AS "personName",
        c.grade AS "grade",
        d.doc_type AS "docType",
        d.name AS "name",
        d.url AS "url",
        d.package_name AS "packageName",
        d.verification_status AS "verificationStatus",
        d.due_date AS "dueDate",
        d.remarks AS "remarks",
        u.name AS "uploadedByName",
        d.created_at AS "createdAt"
      ${base}
      ORDER BY d.created_at DESC
      LIMIT $${p++} OFFSET $${p++}
    `;
    params.push(pageSize, offset);
    const countQuery = `SELECT COUNT(*)::int AS total ${base}`;
    const [rows, count] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);
    return { data: rows.rows, total: count.rows[0]?.total || 0, page, pageSize };
  }

  async create(data: {
    customerId?: string | null;
    serviceCustomerId?: string | null;
    docType: ServiceDocType;
    name: string;
    url?: string | null;
    packageName?: string | null;
    dueDate?: string | null;
    remarks?: string | null;
    userId: string;
  }) {
    const res = await pool.query(
      `INSERT INTO drm.service_documents
        (customer_id, service_customer_id, doc_type, name, url, package_name, due_date, remarks, uploaded_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
       RETURNING id`,
      [
        data.customerId || null,
        data.serviceCustomerId || null,
        data.docType,
        data.name,
        data.url || null,
        data.packageName || null,
        data.dueDate || null,
        data.remarks || null,
        data.userId,
      ],
    );
    return res.rows[0];
  }

  async update(id: string, data: { name?: string; url?: string; packageName?: string; dueDate?: string | null; remarks?: string; userId: string }) {
    const res = await pool.query(
      `UPDATE drm.service_documents
       SET name = COALESCE($2, name),
           url = COALESCE($3, url),
           package_name = COALESCE($4, package_name),
           due_date = COALESCE($5, due_date),
           remarks = COALESCE($6, remarks),
           updated_by = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING id`,
      [id, data.name ?? null, data.url ?? null, data.packageName ?? null, data.dueDate ?? null, data.remarks ?? null, data.userId],
    );
    return res.rows[0] || null;
  }

  async setVerification(id: string, status: string, userId: string) {
    const res = await pool.query(
      `UPDATE drm.service_documents
       SET verification_status = $2, updated_by = $3, updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, status, userId],
    );
    return res.rows[0] || null;
  }

  async remove(id: string) {
    await pool.query(`DELETE FROM drm.service_documents WHERE id = $1`, [id]);
  }
}

export const serviceDocumentsRepository = new ServiceDocumentsRepository();
