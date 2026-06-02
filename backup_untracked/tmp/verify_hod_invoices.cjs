const http = require('http');

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const req = http.request({
            hostname: 'localhost', port: 5000, path, method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        }, (res) => {
            let b = ''; res.on('data', c => b += c);
            res.on('end', () => resolve({ status: res.statusCode, body: b }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function main() {
    // Login to get token
    const loginRes = await request('POST', '/api/auth/login', { email: 'talhaexcelstech@gmail.com', password: 'admin123' }, null);
    const loginData = JSON.parse(loginRes.body);

    if (loginRes.status !== 200) {
        console.error("Login failed:", loginRes.status, loginRes.body);
        return;
    }

    const token = loginData.token;
    console.log("✅ Logged in as:", loginData.user?.email, "role:", loginData.user?.role);

    // Check HOD approvals with Bearer token
    console.log("\n--- GET /api/hod/approvals?status=Pending&page=1&limit=20 ---");
    const approvalsRes = await request('GET', '/api/hod/approvals?status=Pending&page=1&limit=20', null, token);
    console.log("Status:", approvalsRes.status);

    if (approvalsRes.status === 200) {
        const data = JSON.parse(approvalsRes.body);
        console.log("✅ Total items:", data.meta?.total);
        console.log("Returned items:", data.data?.length);
        data.data?.forEach(item => {
            console.log(`  [${item.type}] company=${item.companyName || '-'} status=${item.status} by=${item.submittedByName || '-'}`);
        });

        const invoices = data.data?.filter(i => i.type === 'Invoice') || [];
        console.log(`\n✅ Invoice count: ${invoices.length}`);
        invoices.forEach(inv => {
            console.log("  Invoice:", JSON.stringify(inv, null, 4));
        });
    } else {
        console.error("❌ Error response:", approvalsRes.body);
    }
}

main().catch(console.error);
