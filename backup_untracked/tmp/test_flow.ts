import { pool } from '../server/db';
import { ActivityLogService } from '../server/services/activity-service';
import { NotificationService } from '../server/services/notification-service';
import crypto from 'crypto';

async function testFlow() {
    try {
        console.log("Starting quotation approval test flow...");

        // 1. Find a sales exec user
        const salesExecs = await pool.query(`SELECT id FROM drm.users WHERE role = 'sales_executive' LIMIT 1`);
        if (salesExecs.rows.length === 0) {
            console.log("No sales executives found.");
            return;
        }
        const ownerUserId = salesExecs.rows[0].id;
        console.log("Found Sales Executive:", ownerUserId);

        // 2. Insert a dummy pending quotation
        const mockId = crypto.randomUUID();
        const mockCompany = "Auto Test Company " + Date.now();
        await pool.query(`
      INSERT INTO drm.quotations (id, save_status, company, created_by, grand_total, created_at, updated_at)
      VALUES ($1, 'pending_account_manager', $2, $3, 1000, now(), now())
    `, [mockId, mockCompany, ownerUserId]);
        console.log("Created pending quotation:", mockId);

        // 3. Simulate Account Manager approval logic
        console.log("Approving quotation...");
        const { rows } = await pool.query(`
      UPDATE drm.quotations
      SET save_status = 'Approved', note = 'Approved automatically by test script', updated_at = now()
      WHERE id = $1 AND save_status = 'pending_account_manager'
      RETURNING id, save_status AS "saveStatus", created_by AS "createdBy", company, customer_id AS "customerId"
    `, [mockId]);

        if (rows.length === 0) {
            console.log("Update failed. Quotation not found.");
            return;
        }

        const quotation = rows[0];
        console.log("Quotation update result:", quotation);

        if (quotation.saveStatus === "Approved") {
            const newProjectId = crypto.randomUUID();
            const projectName = \`Proj-\${(quotation.company || "").replace(/\\s+/g, '-').substring(0, 15) || quotation.id.substring(0, 8)}\`;

        // Create the project
        console.log("Creating project with name:", projectName);
        await pool.query(\`
          INSERT INTO projects (id, invoice_id, name, description, owner_user_id, status, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, 'Active', $6, now(), now())
        \`, [
          newProjectId,
          quotation.id,
          projectName,
          \`Auto-created from quotation \${quotation.id}\`,
          ownerUserId,
          ownerUserId
        ]);

        // Log Activity and Notify
        console.log("Logging activity and notifying...");
        await ActivityLogService.log({
          userId: ownerUserId,
          action: "AUTO_CREATED",
          resourceType: "Project",
          resourceId: newProjectId,
          details: \`Auto created from approved quotation \${quotation.id}\`
        });

        await NotificationService.notify({
          userId: ownerUserId,
          message: \`Quotation approved! Project '\${projectName}' auto-created. Please upload requirements.\`,
          type: "SUCCESS"
        });

        console.log("----------------------");
        console.log("Verification:");
        const projConfirm = await pool.query(\`SELECT * FROM projects WHERE id = $1\`, [newProjectId]);
        console.log("Project created:", projConfirm.rows[0]?.name);
        
        const notifConfirm = await pool.query(\`SELECT * FROM drm.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1\`, [ownerUserId]);
        console.log("Latest Notification:", notifConfirm.rows[0]?.message);
    }

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    process.exit(0);
  }
}

testFlow();
