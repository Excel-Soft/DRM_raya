async function test() {
    console.log("=== Testing Auto Project Creation ===");

    const baseUrl = "http://localhost:5000";
    let cookie = "";

    async function makeRequest(method, url, body = null) {
        const options = {
            method,
            headers: { "Content-Type": "application/json" },
        };
        if (cookie) options.headers['Cookie'] = cookie;
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${baseUrl}${url}`, options);
        const text = await res.text();

        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            cookie = setCookie.split(';')[0];
        }

        try { return { status: res.status, data: JSON.parse(text) }; }
        catch (e) { return { status: res.status, data: text }; }
    }

    // 1. Admin login
    console.log("Logging in as Admin (bilalahmed@gmail.com)...");
    let res = await makeRequest("POST", "/api/auth/login", {
        email: "bilalahmed@gmail.com",
        password: "password123",
    });

    if (res.status !== 200) {
        console.log("Admin login failed, trying another...");
        res = await makeRequest("POST", "/api/auth/login", {
            email: "nisar@gmail.com",
            password: "password123",
        });
    }

    console.log("Login result:", res.status);

    // 2. Add a dummy quotation
    const randStr = Math.random().toString(36).substring(7);
    console.log("Adding dummy quotation via raw SQL or API...");
    // we will just use the API if possible, if not I'll just approve an existing one
    res = await makeRequest("GET", "/api/account/pending-quotations?limit=10");
    if (res.status === 200 && res.data.data && res.data.data.length > 0) {
        console.log("Found existing pending quotation!");
        const q = res.data.data[0];

        console.log(`Approving quotation ID: ${q.id} for company: ${q.company}`);
        const approveRes = await makeRequest("POST", `/api/account/pending-quotations/${q.id}/approve`, {
            action: "approve",
            note: "Auto-test approval from script"
        });
        console.log("Approval Status:", approveRes.status);

        // Look for projects
        console.log("Checking projects list...");
        const projRes = await makeRequest("GET", "/api/projects");
        if (projRes.status === 200) {
            const projs = projRes.data.data || projRes.data;
            const myProj = projs.find(p => p.invoiceId === q.id);
            if (myProj) {
                console.log("✅ SUCCESS! Project auto-created:", myProj.name);
            } else {
                console.log("❌ FAILURE! Project not fully created, or invoice mapping missing.");
                console.log("Latest projects dump: ", projs.slice(0, 3).map(p => ({ id: p.id, name: p.name, invoice: p.invoiceId })));
            }
        }

        // Look for notifications
        console.log("Checking notifications for the user...");
        const notifRes = await makeRequest("GET", "/api/notifications");
        if (notifRes.status === 200) {
            const notifs = notifRes.data.data || notifRes.data;
            console.log(`Found ${notifs.length} notifications. Latest:`, notifs[0]?.message);
        }

    } else {
        console.log("No pending quotations found. We need a dummy quotation.");
    }
}

test().catch(console.error);
