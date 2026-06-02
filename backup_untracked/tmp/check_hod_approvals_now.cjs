const http = require('http');

function httpPost(path, body, cookies) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: 5000, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(cookies ? { 'Cookie': cookies } : {}) }
        }, (res) => {
            let body = ''; res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, body, cookies: res.headers['set-cookie'] }));
        });
        req.on('error', reject); req.write(data); req.end();
    });
}

function httpGet(path, cookies) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost', port: 5000, path, method: 'GET',
            headers: { ...(cookies ? { 'Cookie': cookies } : {}) }
        }, (res) => {
            let body = ''; res.on('data', c => body += c);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject); req.end();
    });
}

async function main() {
    const loginRes = await httpPost('/api/auth/login', { email: 'bilalahmed@gmail.com', password: '123456' }, null);
    const cookieStr = loginRes.cookies ? loginRes.cookies.join('; ') : '';

    console.log("Checking HOD Approvals (Waiting tab):");
    const approvalsRes = await httpGet('/api/hod/approvals?status=Pending&page=1&limit=20', cookieStr);
    console.log("Status:", approvalsRes.status);
    const data = JSON.parse(approvalsRes.body);
    if (data.success) {
        console.log("✅ Total approvals:", data.meta?.total);
        console.log("Items:");
        (data.data || []).forEach(item => {
            console.log(`  [${item.type}] ${item.companyName || '-'} | Status: ${item.status} | By: ${item.submittedByName || '-'}`);
        });
    } else {
        console.error("❌ FAILED:", data);
    }
}

main().catch(console.error);
