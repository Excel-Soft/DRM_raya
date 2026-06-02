const http = require('http');

// First get a session token by logging in
function login() {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ username: 'admin', password: 'Admin123!' });
        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log("Login status:", res.statusCode);
                console.log("Login body:", body.substring(0, 500));
                const cookies = res.headers['set-cookie'];
                console.log("Cookies:", cookies);
                resolve({ cookies, body: JSON.parse(body) });
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Then try to save an invoice
function saveInvoice(cookies) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            leadId: "c023cc36-7f6a-4a5a-92ff-39ab20fbedac",
            customerId: null,
            accountHolder: "john",
            company: "Nightspam",
            email: "nightspam@gmail.com",
            contact: "03000000000",
            gstPercent: 10,
            discountType: "PERCENT",
            discountValue: 0,
            items: [
                {
                    productId: "Domain Registration",
                    detail: "ok",
                    unitPrice: 0.5,
                    quantity: 1,
                    startYear: 2026,
                    endYear: 2026
                }
            ]
        });

        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path: '/api/quotations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
                'Cookie': cookies ? cookies.join('; ') : ''
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log("\n--- Invoice Save Response ---");
                console.log("Status:", res.statusCode);
                console.log("Body:", body);
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function main() {
    try {
        const { cookies } = await login();
        await saveInvoice(cookies);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

main();
