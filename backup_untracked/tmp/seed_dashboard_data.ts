import { pool } from "../server/db";
import { randomUUID } from "crypto";

async function seedData() {
    try {
        console.log("Starting data seeding...");

        // 1. Get Users
        const usersRes = await pool.query("SELECT id, full_name, role_id FROM users LIMIT 10");
        const users = usersRes.rows;
        if (users.length === 0) {
            console.error("No users found to associate data with.");
            return;
        }

        const admin = users.find(u => u.role_id === 'admin') || users[0];
        const talha = users.find(u => u.full_name && u.full_name.includes('Talha')) || users[0];

        console.log(`Seeding data for User: ${admin.full_name} (${admin.id}) and ${talha.full_name} (${talha.id})`);

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // 2. Create Customers (Leads)
        const customerCount = 10;
        const customerIds = [];
        for (let i = 0; i < customerCount; i++) {
            const id = randomUUID();
            customerIds.push(id);
            await pool.query(`
            INSERT INTO customers (id, company_name, account_name, email, phone, region, grade, status, owner_user_id, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
                id,
                `Test Company ${i}`,
                `Account ${i}`,
                `test${i}@example.com`,
                `+92300000000${i}`,
                'Lahore',
                i % 2 === 0 ? 'A-' : 'B+',
                i % 3 === 0 ? 'New' : 'Renew',
                i % 2 === 0 ? admin.id : talha.id,
                admin.id,
                now,
                now
            ]);
        }
        console.log(`Inserted ${customerCount} customers.`);

        // 3. Create Activities
        const activityTypes = ['mobile', 'whatsapp', 'email', 'onsite'];
        for (let i = 0; i < 20; i++) {
            await pool.query(`
            INSERT INTO activities (id, customer_id, created_by, type, notes, activity_date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
                randomUUID(),
                customerIds[i % customerIds.length],
                i % 2 === 0 ? admin.id : talha.id,
                activityTypes[i % activityTypes.length],
                `Follow up call ${i}`,
                now,
                now
            ]);
        }
        console.log(`Inserted 20 activities.`);

        // 4. Create Opportunities
        const oppStages = ['LD', 'QF', 'GM', 'Won'];
        const oppIds = [];
        for (let i = 0; i < 8; i++) {
            const id = randomUUID();
            oppIds.push(id);
            await pool.query(`
            INSERT INTO opportunities (id, customer_id, title, stage, value, owner_id, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                id,
                customerIds[i % customerIds.length],
                `Opportunity ${i}`,
                oppStages[i % oppStages.length],
                (i + 1) * 1000,
                i % 2 === 0 ? admin.id : talha.id,
                now,
                now
            ]);
        }
        console.log(`Inserted 8 opportunities.`);

        // 5. Create GM Entries (Revenue)
        for (let i = 0; i < 4; i++) {
            await pool.query(`
            INSERT INTO gm_entries (
                id, customer_id, created_by, amount, status, gm_type, drm_id, company_name, 
                package_type, entry_type, amount_usd, amount_pkr, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
                randomUUID(),
                customerIds[i],
                i % 2 === 0 ? admin.id : talha.id,
                500 * (i + 1),
                'Approved',
                'GM',
                `DRM-${i}`,
                `Test Company ${i}`,
                'Standard',
                'New',
                500 * (i + 1),
                140000 * (i + 1),
                now,
                now
            ]);
        }
        console.log(`Inserted 4 GM entries.`);

        // 6. Create Appointments (Meetings)
        for (let i = 0; i < 5; i++) {
            await pool.query(`
            INSERT INTO appointments (id, customer_id, assigned_to, starts_at, ends_at, location, notes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                randomUUID(),
                customerIds[i],
                i % 2 === 0 ? admin.id : talha.id,
                now,
                new Date(now.getTime() + 60 * 60 * 1000),
                'Online',
                `Strategy meeting ${i}`,
                now
            ]);
        }
        console.log(`Inserted 5 appointments.`);

        // 7. PMS Data (Projects & Tasks)
        const projectIds = [];
        for (let i = 0; i < 3; i++) {
            const id = randomUUID();
            projectIds.push(id);
            await pool.query(`
            INSERT INTO projects (id, name, description, status, owner_user_id, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
                id,
                `Project ${i}`,
                `Description for project ${i}`,
                i % 2 === 0 ? 'Active' : 'Completed',
                talha.id,
                admin.id,
                now
            ]);
        }
        console.log(`Inserted 3 projects.`);

        const taskStatuses = ['ToDo', 'InProgress', 'Completed', 'Blocked'];
        for (let i = 0; i < 10; i++) {
            await pool.query(`
            INSERT INTO tasks (
                id, project_id, title, status, priority, assigned_to_user_id, owner_user_id, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                randomUUID(),
                projectIds[i % projectIds.length],
                `Task ${i}`,
                taskStatuses[i % taskStatuses.length],
                'Medium',
                talha.id,
                admin.id,
                now
            ]);
        }
        console.log(`Inserted 10 tasks.`);

        console.log("Seeding completed successfully!");
        process.exit(0);

    } catch (err) {
        console.error("Error during seeding:", err);
        process.exit(1);
    }
}

seedData();
