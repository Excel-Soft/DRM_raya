import { pool } from "../../db";

function makeStub(label: string): any {
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") return undefined;
      return makeStub(label + "." + String(prop));
    },
    apply(_target, _thisArg, args) {
      console.warn("[stub] " + label + "(...) called — real implementation is missing from this checkout.");
      return Promise.resolve(undefined);
    },
  });
}

export const createOrLinkProjectForApprovedInvoice = makeStub("createOrLinkProjectForApprovedInvoice");
export const createOrLinkProjectForGm = makeStub("createOrLinkProjectForGm");

export async function createOrLinkProjectForLegacySource({
  sourceId,
  customerId,
  ownerUserId,
  name,
  description,
  actorUserId,
  req,
}: any) {
  try {
    const existing = await pool.query(
      `SELECT id FROM drm.projects WHERE invoice_id = $1 AND COALESCE(is_deleted, false) = false LIMIT 1`,
      [sourceId]
    );
    if (existing.rows[0]) {
      return { ok: true, created: false, linked: true, projectId: existing.rows[0].id, reason: "Already exists" };
    }
    
    let deptType = 'DESIGN_DEVELOPMENT';
    let serviceType = '';
    
    // Function to check items against service_subservices for proper routing
    const resolveDepartmentFromItems = async (items: any[]) => {
        if (!items || items.length === 0) return false;
        for (const item of items) {
            // First check subservices
            const ssRes = await pool.query(`SELECT project_department FROM drm.service_subservices WHERE name = $1 LIMIT 1`, [item.name]);
            if (ssRes.rows[0] && ssRes.rows[0].project_department) {
                deptType = ssRes.rows[0].project_department;
                serviceType = item.name;
                return true;
            }
            // Then check main services
            const sRes = await pool.query(`SELECT project_department FROM drm.services WHERE name = $1 LIMIT 1`, [item.name]);
            if (sRes.rows[0] && sRes.rows[0].project_department) {
                deptType = sRes.rows[0].project_department;
                serviceType = item.name;
                return true;
            }
        }
        // Fallback: If not matched in db exactly, look for keywords
        const hasSeoSmm = items.some((it: any) => 
            String(it.name).toUpperCase().includes('SEO') || 
            String(it.name).toUpperCase().includes('SMM')
        );
        if (hasSeoSmm) {
            deptType = 'SEO/SMM';
            serviceType = items[0]?.name || '';
            return true;
        }
        return false;
    };

    const getItems = (row: any) => {
        if (!row || !row.items) return [];
        let items = row.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { items = []; }
        }
        return Array.isArray(items) ? items : [];
    };

    // Check invoice items
    const invRes = await pool.query(`SELECT items FROM drm.invoices WHERE id = $1`, [sourceId]);
    const invItems = getItems(invRes.rows[0]);
    if (invItems.length > 0) {
        await resolveDepartmentFromItems(invItems);
    } else {
        // Fallback to check quotation items
        const qRes = await pool.query(`SELECT items FROM drm.quotations WHERE id = $1`, [sourceId]);
        const qItems = getItems(qRes.rows[0]);
        if (qItems.length > 0) {
            await resolveDepartmentFromItems(qItems);
        }
    }

    const ins = await pool.query(
      `INSERT INTO drm.projects (
          invoice_id, name, customer_id, owner_user_id, status, department_type, service_type, description, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'Active', $5, $6, $7, now(), now()) RETURNING id`,
      [sourceId, name || 'Standard Project', customerId, ownerUserId, deptType, serviceType || null, description || '']
    );

    return { ok: true, created: true, linked: false, projectId: ins.rows[0].id };
  } catch (err) {
    console.error("Failed to create project for legacy source:", err);
    return { ok: false, reason: "Unexpected error" };
  }
}
