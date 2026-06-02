const { Pool } = require('pg');
const http = require('http');

const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

function httpPost(path, body, cookies) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                ...(cookies ? { 'Cookie': cookies } : {})
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({
                status: res.statusCode,
                body: body,
                cookies: res.headers['set-cookie']
            }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    // Step 1: Get a user email from DB
    console.log("1. Fetching a user from DB...");
    const userRes = await pool.query("SELECT id, email, full_name, role FROM drm.users WHERE is_active = true LIMIT 5");
    console.log("Available users:");
    userRes.rows.forEach(u => console.log(`  - ${u.email} [${u.role}] id=${u.id}`));

    // Try to find a sales executive or admin
    const testUser = userRes.rows.find(u =>
        u.role && (
            u.role.toLowerCase().includes('sales') ||
            u.role.toLowerCase().includes('admin') ||
            u.role.toLowerCase().includes('executive')
        )
    ) || userRes.rows[0];

    if (!testUser) {
        console.error("No users found!");
        process.exit(1);
    }

    console.log(`\nUsing user: ${testUser.email} [${testUser.role}]`);

    // Step 2: Get this user's plain password from DB
    const passRes = await pool.query("SELECT password FROM drm.users WHERE id = $1", [testUser.id]);
    const plainPassword = passRes.rows[0]?.password;

    if (!plainPassword) {
        console.error("User has no plain password stored — trying known passwords...");
        // Try common passwords
        const commonPwd = ['Admin@1234', 'admin123', 'Admin123!', 'password123', '123456'];
        for (const pwd of commonPwd) {
            console.log(`Trying: ${pwd}`);
            const loginRes = await httpPost('/api/auth/login', { email: testUser.email, password: pwd }, null);
            console.log(`  Status: ${loginRes.status}, Body: ${loginRes.body.substring(0, 100)}`);
            if (loginRes.status === 200) {
                console.log("✅ Login successful with:", pwd);
                const cookieStr = loginRes.cookies ? loginRes.cookies.join('; ') : '';
                await testInvoiceSave(cookieStr);
                break;
            }
        }
        await pool.end();
        return;
    }

    console.log(`\n2. Logging in with email: ${testUser.email}, password: ${plainPassword.substring(0, 3)}***`);
    const loginRes = await httpPost('/api/auth/login', { email: testUser.email, password: plainPassword }, null);
    console.log("Login status:", loginRes.status);
    console.log("Login body:", loginRes.body.substring(0, 300));

    if (loginRes.status !== 200) {
        console.error("Login failed! Body:", loginRes.body);
        await pool.end();
        return;
    }

    const cookieStr = loginRes.cookies ? loginRes.cookies.join('; ') : '';
    await testInvoiceSave(cookieStr);
    await pool.end();
}

async function testInvoiceSave(cookieStr) {
    console.log("\n3. Testing invoice save...");
    const invoiceRes = await httpPost('/api/quotations', {
        leadId: "c023cc36-7f6a-4a5a-92ff-39ab20fbedac",
        customerId: null,
        accountHolder: "john",
        company: "Nightspam",
        email: "nightspam@gmail.com",
        contact: "03000000000",
        gstPercent: 10,
        discountType: "PERCENT",
        discountValue: 0,
        items: [{
            productId: "Domain Registration",
            detail: "ok",
            unitPrice: 0.5,
            quantity: 1,
            startYear: 2026,
            endYear: 2026
        }]
    }, cookieStr);

    console.log("\n=== INVOICE SAVE RESULT ===");
    console.log("Status:", invoiceRes.status);
    console.log("Response:", invoiceRes.body);

    if (invoiceRes.status === 201) {
        console.log("✅ Invoice saved successfully!");
    } else {
        console.error("❌ Invoice save FAILED with status:", invoiceRes.status);
    }
}

main().catch(err => {
    console.error("Fatal error:", err);
    pool.end();
    process.exit(1);
});
