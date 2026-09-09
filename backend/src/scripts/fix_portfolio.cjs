require('dotenv').config();
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const res = await pool.query("SELECT allowed_role_ids FROM drm.menu_permissions WHERE name ILIKE '%Portfolio%'");
    if (res.rows.length > 0) {
      console.log("Current Portfolio roles:", res.rows[0].allowed_role_ids);
      
      const newRoles = res.rows[0].allowed_role_ids.filter(r => 
        !r.toLowerCase().includes('posting_executive')
      );
      
      await pool.query("UPDATE drm.menu_permissions SET allowed_role_ids = $1 WHERE name ILIKE '%Portfolio%'", [newRoles]);
      console.log("Updated Portfolio roles:", newRoles);
    }
    
    // While we are at it, what was the second module? "ya dono is ko". The second one they clicked in the picture? 
    // They boxed Portfolio. The box covers Portfolio and Posting Data? 
    // Oh, their green box circles "Portfolio" AND "Posting Data"?? 
    // Wait!! The green box is around "Portfolio" menu. The green box in the second screenshot explicitly circles:
    // "Add Keywords" AND what else?
    // Wait, let me look at the FIRST screenshot again.
    // The user sent TWO messages:
    // 1st msg: "ya is ko nhi show hony chaye ha" -> Shows a screenshot of "Add Keywords" boxed in green.
    // 2nd msg: "o yr ya dono is ko q show ho rhy ha in ko access nhi ha set kro jaldi" -> Shows a screenshot of "Portfolio" boxed in green.
    // Ah, "dono" (both) refers to "Add Keywords" AND "Portfolio".
    // I ALREADY fixed "Add Keywords" by using `multi_replace_file_content` in `app-sidebar.tsx`.
    // Now I must fix Portfolio!
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
