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
    // Login
    const loginRes = await request('POST', '/api/auth/login', { email: 'talhaexcelstech@gmail.com', password: 'admin123' }, null);
    const token = JSON.parse(loginRes.body).token;
    console.log("✅ Logged in");

    // Check HOD approvals
    const approvalsRes = await request('GET', '/api/hod/approvals?status=Pending&page=1&limit=20', null, token);
    const approvals = JSON.parse(approvalsRes.body);
    const invoices = approvals.data?.filter(a => a.type === 'Invoice') || [];
    console.log("\n📋 HOD Pending Invoices:", invoices.length);
    invoices.forEach((inv, i) => console.log(`  ${i + 1}. ${inv.companyName} | status=${inv.status} | id=${inv.id.slice(0, 8)}...`));

    if (invoices.length === 0) {
        console.log("❌ No pending invoices to test with");
        return;
    }

    // HOD approve the first invoice
    const firstInvoice = invoices[0];
    console.log(`\n🔄 HOD approving invoice: ${firstInvoice.id.slice(0, 8)}...`);
    const approveRes = await request('POST', `/api/hod/approvals/${firstInvoice.id}/approve`, {}, token);
    const approveData = JSON.parse(approveRes.body);
    console.log("HOD Approve status:", approveRes.status);
    console.log("HOD Approve result:", JSON.stringify(approveData, null, 2));

    // Check Account Manager pending quotations
    console.log("\n📋 Checking Account Manager pending-quotations...");
    const amRes = await request('GET', '/api/account/pending-quotations', null, token);
    const amData = JSON.parse(amRes.body);
    console.log("AM endpoint status:", amRes.status);
    console.log("AM pending invoices total:", amData?.meta?.total);
    (amData?.data || []).forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.company} | status=${q.saveStatus} | amount=$${q.grandTotal}`);
    });
}

main().catch(console.error);
