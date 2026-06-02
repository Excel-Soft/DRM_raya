import pg from 'pg';
import 'dotenv/config';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    await client.query("SET search_path TO drm, public");

    console.log("Adding and ensuring all required menus...");

    const allModulesRoles = ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "service_manager", "service_assistant_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"];

    // First rename Reports -> User Reports if only 'Reports' exists
    const hasReports = await client.query("SELECT id FROM menu_permissions WHERE name = 'Reports'");
    const hasUserReports = await client.query("SELECT id FROM menu_permissions WHERE name = 'User Reports'");
    
    if (hasReports.rows.length > 0 && hasUserReports.rows.length === 0) {
      await client.query("UPDATE menu_permissions SET name = 'User Reports', menu_icon = 'FileText' WHERE name = 'Reports'");
      console.log("Renamed old Reports to User Reports.");
    }

    const menusToAdd = [
      { 
        name: 'LEAD', 
        icon: 'Layers', 
        roles: allModulesRoles, 
        subUrls: ['/sales/lead-pools', '/customers/gmbv-pool'] 
      },
      { 
        name: 'User Reports', 
        icon: 'FileText', 
        roles: allModulesRoles, 
        subUrls: ['/reports/loan', '/reports/vas', '/reports/gm', '/reports/bv'] 
      },
      { 
        name: 'PMS Reports', 
        icon: 'PieChart', 
        roles: allModulesRoles, 
        subUrls: ['/pms/project-report', '/it/system-report'] 
      },
      { 
        name: 'Reports', 
        icon: 'PieChart', 
        roles: ["admin", "super_hod"], 
        subUrls: ['/analytics/user-activity', '/analytics/ledger', '/analytics/gm', '/analytics/refund', '/analytics/invoice', '/reports/vas', '/reports/vas/new'] 
      }
    ];

    for (const menu of menusToAdd) {
      const existing = await client.query("SELECT id FROM menu_permissions WHERE name = $1", [menu.name]);
      const subUrlsJson = JSON.stringify({ isRoot: true, items: menu.subUrls });

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO menu_permissions (name, menu_icon, allowed_role_ids, is_active, permissions, sub_urls)
          VALUES ($1, $2, $3, true, '[]'::jsonb, $4)
        `, [menu.name, menu.icon, menu.roles, subUrlsJson]);
        console.log(`Created menu: ${menu.name}`);
      } else {
        await client.query(`
          UPDATE menu_permissions 
          SET allowed_role_ids = $1, menu_icon = $2, sub_urls = $3, is_active = true
          WHERE name = $4
        `, [menu.roles, menu.icon, subUrlsJson, menu.name]);
        console.log(`Updated menu: ${menu.name}`);
      }
    }

    console.log("Successfully synchronized all menus.");
    client.release();
  } catch (err) {
    console.error("Error during update:", err);
  } finally {
    await pool.end();
  }
}

main();
