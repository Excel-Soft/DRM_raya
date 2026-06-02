const http = require('http');

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
                body,
                cookies: res.headers['set-cookie']
            }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

function httpGet(path, cookies) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path,
            method: 'GET',
            headers: {
                ...(cookies ? { 'Cookie': cookies } : {})
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function main() {
    // Login as bilal (admin)
    const loginRes = await httpPost('/api/auth/login', { email: 'bilalahmed@gmail.com', password: '123456' }, null);
    const cookieStr = loginRes.cookies ? loginRes.cookies.join('; ') : '';

    console.log("1. Checking /api/hod/approvals (Waiting tab data):");
    const approvalsRes = await httpGet('/api/hod/approvals?status=Pending&page=1&limit=10', cookieStr);
    console.log("Status:", approvalsRes.status);
    const appData = JSON.parse(approvalsRes.body);
    console.log("Total:", appData?.meta?.total);
    console.log("Items count:", appData?.data?.length);
    if (appData?.data?.length > 0) {
        console.log("First item:", JSON.stringify(appData.data[0], null, 2));
    } else {
        console.log("NO ITEMS — this is the bug!");
        console.log("Full response:", JSON.stringify(appData, null, 2));
    }

    console.log("\n2. Checking quotations directly in DB:");
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });

    const qRes = await pool.query("SELECT id, company, save_status, created_by, created_at FROM drm.quotations WHERE save_status = 'pending_hod' ORDER BY created_at DESC LIMIT 5");
    console.log("Quotations with pending_hod:", JSON.stringify(qRes.rows, null, 2));

    await pool.end();
}

main().catch(console.error);
