import pg from 'pg';
import 'dotenv/config';

async function createTable() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Checking database table...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS drm.portfolios (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                keyword TEXT,
                main_category TEXT,
                sub_category TEXT,
                server_link TEXT,
                top_header_image TEXT,
                body_image TEXT,
                full_image TEXT,
                sliders JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `);
        
        console.log('Table portfolios created or already exists.');
        
        // Let's add a dummy entry to test
        const res = await pool.query(`
            INSERT INTO drm.portfolios (keyword, main_category) 
            VALUES ('Sports Wear', 'Website')
            RETURNING id;
        `);
        console.log('Seeded one item id:', res.rows[0].id);

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

createTable();
