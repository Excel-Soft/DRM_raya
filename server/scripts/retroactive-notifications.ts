import { pool } from "../db";
import { NotificationService } from "../services/notification-service";

async function run() {
  console.log("[Retroactive-Notifications] Starting script...");
  try {
    let notificationsCreated = 0;

    // --- PHASE 1: SCAN PROJECTS IN "Documents Pending" STATUS ---
    console.log("[Retroactive-Notifications] Phase 1: Scanning projects in 'Documents Pending' status...");
    const { rows: projects } = await pool.query(`
      SELECT 
        id, 
        name, 
        owner_user_id, 
        created_at 
      FROM drm.projects 
      WHERE status = 'Documents Pending'
        AND created_at >= NOW() - INTERVAL '14 days'
    `);

    console.log(`[Retroactive-Notifications] Found ${projects.length} recent 'Documents Pending' projects.`);

    for (const project of projects) {
      const salesPersonId = project.owner_user_id;
      if (!salesPersonId) continue;

      // Check if a notification already exists for this user and project name
      const checkMessagePattern = `%${project.name}%`;
      const { rows: existingNotifs } = await pool.query(
        "SELECT id FROM drm.notifications WHERE user_id = $1 AND message ILIKE $2 LIMIT 1",
        [salesPersonId, checkMessagePattern]
      );

      if (existingNotifs.length > 0) {
        console.log(`[Retroactive-Notifications] Project notification already exists for '${project.name}'. Skipping.`);
        continue;
      }

      console.log(`[Retroactive-Notifications] Creating missing project notification for '${project.name}' to user ${salesPersonId}`);
      await NotificationService.notify({
        userId: salesPersonId,
        message: `New project '${project.name}' created. Please upload the required documents in the PMS module to proceed.`,
        type: "SUCCESS",
        targetUrl: "/pms/approvals"
      });
      notificationsCreated++;
    }

    // --- PHASE 2: SCAN RECENTLY APPROVED GM ENTRIES ---
    console.log("[Retroactive-Notifications] Phase 2: Scanning recently approved GM entries...");
    const { rows: entries } = await pool.query(`
      SELECT 
        id, 
        drm_id, 
        company_name, 
        sales_person_id, 
        sales_person_name, 
        created_by, 
        customer_id 
      FROM drm.gm_entries 
      WHERE (status = 'Approved' OR approval_status IN ('approved', 'approved_by_account'))
        AND created_at >= NOW() - INTERVAL '14 days'
        AND coalesce(is_deleted, false) = false
    `);

    console.log(`[Retroactive-Notifications] Found ${entries.length} recently approved GM entries.`);

    for (const entry of entries) {
      let salesPersonId = entry.sales_person_id;

      // Resolve Sales Person ID if null
      if (!salesPersonId) {
        if (entry.customer_id) {
          const custRes = await pool.query("SELECT owner_user_id FROM drm.customers WHERE id = $1", [entry.customer_id]);
          if (custRes.rows[0]?.owner_user_id) {
            salesPersonId = custRes.rows[0].owner_user_id;
          }
        }
        if (!salesPersonId && entry.sales_person_name) {
          const userRes = await pool.query(
            "SELECT id FROM drm.users WHERE lower(full_name) = lower($1) OR lower(name) = lower($1) OR lower(username) = lower($1) LIMIT 1",
            [entry.sales_person_name.trim()]
          );
          if (userRes.rows[0]?.id) {
            salesPersonId = userRes.rows[0].id;
          }
        }
        if (!salesPersonId && entry.created_by) {
          salesPersonId = entry.created_by;
        }
      }

      if (!salesPersonId) {
        console.log(`[Retroactive-Notifications] Could not resolve salesPersonId for entry ID: ${entry.id} (${entry.company_name})`);
        continue;
      }

      // Check if a notification already exists for this user and company
      const checkMessagePattern = `%${entry.company_name}%`;
      const { rows: existingNotifs } = await pool.query(
        "SELECT id FROM drm.notifications WHERE user_id = $1 AND message ILIKE $2 LIMIT 1",
        [salesPersonId, checkMessagePattern]
      );

      if (existingNotifs.length > 0) {
        console.log(`[Retroactive-Notifications] GM notification already exists for company '${entry.company_name}'. Skipping.`);
        continue;
      }

      // Create Notification
      console.log(`[Retroactive-Notifications] Creating missing GM notification for company '${entry.company_name}' to user ${salesPersonId}`);
      await NotificationService.notify({
        userId: salesPersonId,
        message: `Your GM entry for company '${entry.company_name || 'Unknown'}' has been approved by the Accounts Department. Please upload the required documents.`,
        type: "SUCCESS",
        targetUrl: "/pms/approvals"
      });
      notificationsCreated++;
    }

    console.log(`[Retroactive-Notifications] Done! Created ${notificationsCreated} retroactive notifications.`);
  } catch (error) {
    console.error("[Retroactive-Notifications] Error executing script:", error);
  } finally {
    process.exit(0);
  }
}

run();
