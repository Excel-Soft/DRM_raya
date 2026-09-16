import { pool } from "../../db";

export const generateDefaultInvoicesForGm = async (params: any) => {
  const { gmId, customerId, companyName, ownerUserId } = params;

  if (!gmId || !ownerUserId) {
    console.error("[gm-invoice-generation] missing required params", params);
    return;
  }

  const defaultServices = [
    { projectName: "Alibaba Product Posting", invoiceType: "Product Posting" },
    { projectName: "Alibaba Minisite", invoiceType: "Minisite" },
    { projectName: "Listing Page", invoiceType: "Listing Page" },
  ];

  for (const svc of defaultServices) {
    try {
      await pool.query(
        `INSERT INTO drm.product_posting_invoices (
          invoice_number,
          amount,
          sales_exec_id,
          customer_id,
          project_name,
          company_name,
          status,
          gm_id,
          invoice_type,
          auto_generated,
          generated_by,
          generated_at
        ) VALUES (
          'AUTO-' || nextval('drm.product_posting_invoice_number_seq'),
          0,
          $1,
          $2,
          $3,
          $4,
          'PENDING_HOD',
          $5,
          $6,
          true,
          $7,
          now()
        )`,
        [
          ownerUserId,
          customerId || null,
          svc.projectName,
          companyName || null,
          gmId,
          svc.invoiceType,
          ownerUserId
        ]
      );
    } catch (e) {
      console.error(`[gm-invoice-generation] failed to generate ${svc.projectName} for GM ${gmId}:`, e);
    }
  }
};

export const revertGmInvoicesToHodOnReject = async (gmId: string, actorUserId: string, req?: any) => {};

export const generateInvoicesAfterFinalGmApproval = async (gmId: string, actorUserId: string, req?: any) => {
  try {
    const { rows } = await pool.query("SELECT customer_id, company_name, created_by FROM drm.gm_entries WHERE id = $1", [gmId]);
    if (rows.length === 0) return { synced: 0 };
    const gm = rows[0];

    await generateDefaultInvoicesForGm({
      gmId,
      customerId: gm.customer_id,
      companyName: gm.company_name,
      ownerUserId: gm.created_by // The sales executive who created the GM
    });
    return { synced: 1 };
  } catch (err) {
    console.error("[gm-invoice-generation] Failed in generateInvoicesAfterFinalGmApproval:", err);
    return { synced: 0 };
  }
};

export const syncGmInvoicesAfterHodApproval = async (gmId: string, actorUserId: string, req?: any) => {
  return { synced: 0 };
};
