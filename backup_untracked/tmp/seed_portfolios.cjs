const pg = require('pg');
require('dotenv').config();

async function seedPortfolios() {
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Seeding portfolio items with images...');
        
        // Remove old test data first if needed
        // await pool.query('DELETE FROM drm.portfolios');

        const items = [
            {
                keyword: 'Sports Wear Red',
                main_category: 'Website',
                sub_category: 'E-commerce',
                full_image: '/portfolio/sports-wear-1.png',
                design_by: 'Muhammad Tuqeer Razaq',
                status: 'un-used'
            },
            {
                keyword: 'Boxing Store Pro',
                main_category: 'Website',
                sub_category: 'Professional',
                full_image: '/portfolio/boxing-store.png',
                design_by: 'Muhammad Tuqeer Razaq',
                status: 'used'
            },
            {
                keyword: 'JD Minisite',
                main_category: 'Minisite',
                sub_category: 'Corporate',
                full_image: '/portfolio/minisite-jd.png',
                design_by: 'Muhammad Tuqeer Razaq',
                status: 'un-used'
            },
            {
                keyword: 'Sports Wear Blue',
                main_category: 'Website',
                sub_category: 'E-commerce',
                full_image: '/portfolio/sports-wear-1.png',
                design_by: 'Muhammad Tuqeer Razaq',
                status: 'reserved'
            }
        ];

        for (const item of items) {
            await pool.query(`
                INSERT INTO drm.portfolios (keyword, main_category, sub_category, full_image, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [item.keyword, item.main_category, item.sub_category, item.full_image]);
        }
        
        console.log('Successfully seeded 4 items.');

    } catch (err) {
        console.error('Seeding failed:', err.message);
    } finally {
        await pool.end();
    }
}

seedPortfolios();
