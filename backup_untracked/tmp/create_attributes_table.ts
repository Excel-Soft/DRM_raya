import { pool } from "../server/db";

async function run() {
    try {
        const query = `
      CREATE TABLE IF NOT EXISTS drm.attributes (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category varchar(100) NOT NULL,
        name varchar(255) NOT NULL,
        description text,
        is_active boolean DEFAULT true NOT NULL,
        metadata jsonb DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
    `;
        await pool.query(query);
        console.log("Successfully created drm.attributes table");
    } catch (error) {
        console.error("Error creating table:", error);
    } finally {
        process.exit();
    }
}

run();
