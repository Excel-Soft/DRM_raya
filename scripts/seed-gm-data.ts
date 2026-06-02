
import { pool } from "../server/db";

async function seedGmData() {
    try {
        console.log("🌱 Seeding GM data...");

        // 1. Get a user
        const userRes = await pool.query(`
      SELECT id, username FROM users 
      WHERE username ILIKE '%talha%' OR role = 'admin' 
      LIMIT 1
    `);

        if (userRes.rows.length === 0) {
            console.error("❌ No suitable user found to assign GM data to.");
            process.exit(1);
        }

        const userId = userRes.rows[0].id;
        const userName = userRes.rows[0].username;
        console.log(`👤 Assigning data to user: ${userName} (${userId})`);

        // 2. Insert sample GM data
        const entries = [
            { company: "Trusmile Surgical", package: "364", amount: 364, type: "New" },
            { company: "Apex Innovations", package: "Gold", amount: 1000, type: "Renewal" },
            { company: "Quantum Leaps", package: "364", amount: 364, type: "New" },
            { company: "Blue Horizon", package: "Gold", amount: 1200, type: "Rc" },
            { company: "Stellar Dynamics", package: "364", amount: 364, type: "New" },
            { company: "Future Vision", package: "Gold", amount: 1500, type: "Renewal" },
        ];

        for (const entry of entries) {
            const drmId = `DRM-${Math.floor(Math.random() * 10000)}`;
            await pool.query(`
        INSERT INTO gm_entries (
          company_name, 
          package_type, 
          amount_usd, 
          final_order_usd, 
          entry_type, 
          gm_type,
          sales_person_id, 
          sales_person_name, 
          created_by_user_id,
          status,
          drm_id,
          created_at
        )
        VALUES ($1, $2, $3, $3, $4, 'GM', $5, $6, $5, 'Approved', $7, NOW())
      `, [
                entry.company,
                entry.package,
                entry.amount,
                entry.type,
                userId,
                userName,
                drmId
            ]);
        }

        console.log(`✅ Successfully inserted ${entries.length} GM records.`);

    } catch (err) {
        console.error("❌ Error seeding data:", err);
    } finally {
        process.exit();
    }
}

seedGmData();
