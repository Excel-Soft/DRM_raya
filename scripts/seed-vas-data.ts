
import { pool } from "../server/db";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function seedVasData() {
    try {
        console.log("🌱 Seeding VAS data...");

        // 1. Get a user to assign data to (e.g., Talha or the first admin)
        const userRes = await pool.query(`
      SELECT id, username FROM users 
      WHERE username ILIKE '%talha%' OR role = 'admin' 
      LIMIT 1
    `);

        if (userRes.rows.length === 0) {
            console.error("❌ No suitable user found to assign VAS data to.");
            process.exit(1);
        }

        const userId = userRes.rows[0].id;
        console.log(`👤 Assigning data to user: ${userRes.rows[0].username} (${userId})`);

        // 2. Insert sample VAS data
        const entries = [
            { company: "Tech Solutions Ltd", amount: 50000, method: "Bank Transfer", date: '2026-01-15' },
            { company: "Global Traders", amount: 25000, method: "Cash", date: '2026-01-20' },
            { company: "Alpha Corp", amount: 75000, method: "Online", date: '2026-02-01' },
            { company: "NextGen Systems", amount: 15000, method: "Cheque", date: '2026-02-02' },
            { company: "Creative Minds", amount: 45000, method: "Bank Transfer", date: '2026-02-03' }
        ];

        for (const entry of entries) {
            await pool.query(`
        INSERT INTO office_vas (company_name, amount, method, vas_date, created_by_user_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [entry.company, entry.amount, entry.method, entry.date, userId, "System generated seed data"]);
        }

        console.log(`✅ Successfully inserted ${entries.length} VAS records.`);

    } catch (err) {
        console.error("❌ Error seeding data:", err);
    } finally {
        process.exit();
    }
}

seedVasData();
