import pg from "pg";
import dotenv from "dotenv";
import {
    ensureMenuPermissionsTable,
    seedMenuPermissionsFromLegacyIfEmpty,
} from "../utils/menu-permissions-bootstrap.ts";

dotenv.config();

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    try {
        await ensureMenuPermissionsTable(client);
        const inserted = await seedMenuPermissionsFromLegacyIfEmpty(client);
        const count = await client.query("SELECT COUNT(*)::int AS n FROM drm.menu_permissions");
        console.log(`menu_permissions: inserted ${inserted}, total ${count.rows[0].n}`);
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
