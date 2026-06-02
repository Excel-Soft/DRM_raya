const fs = require('fs');

async function testProjectCreation() {
    console.log("=== Testing Auto Project Creation ===");

    const baseUrl = "http://localhost:5000";
    let cookie = "";

    // Helper to make requests
    async function makeRequest(method, url, body = null, headers = {}) {
        const options = {
            method,
            headers: { ...headers, "Content-Type": "application/json" },
        };
        if (cookie) options.headers['Cookie'] = cookie;
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${baseUrl}${url}`, options);
        const text = await res.text();

        // Grab cookie for auth
        const setCookie = res.headers.get('set-cookie');
        if (setCookie) {
            cookie = setCookie.split(';')[0];
        }

        let data;
        try { data = JSON.parse(text); } catch (e) { data = text; }
        return { status: res.status, data };
    }

    // 1. Try to Login as Account Manager to be able to bypass things or we need a real user.
    // We can just login as an admin for testing since they bypass everything.
    console.log("1. Logging in as admin...");
    let res = await makeRequest("POST", "/api/auth/login", {
        email: "admin@webexcels.com", // Assuming an admin exists
        password: "password123", // Assuming standard password
    });

    if (res.status === 401) {
        console.log("Trying different credentials for admin...");
        res = await makeRequest("POST", "/api/auth/login", {
            email: "hadi@test.com", // Check for hadi
            password: "password123",
        });
    }

    console.log("Login result:", res.status, res.data.message || res.data.error || "Success");

    if (res.status !== 200) {
        console.log("Failed to login, skipping api test. You'll need to test it manually via UI.");
        return;
    }

    console.log("\n2. Getting current user info...");
    res = await makeRequest("GET", "/api/auth/me");
    const myUser = res.data?.user || res.data;
    console.log("Logged in as:", myUser?.fullName || "Unknown", "| Role:", myUser?.role);

    // Lets fetch quotations to approve one.
    console.log("\n3. Fetching pending quotations...");
    res = await makeRequest("GET", "/api/account/pending-quotations");

    if (res.status === 200 && res.data?.data?.length > 0) {
        const q = res.data.data[0];
        console.log("Found quotation:", q.id, "for company:", q.company);

        console.log("\n4. Approving quotation...");
        const approveRes = await makeRequest("POST", `/api/account/pending-quotations/${q.id}/approve`, {
            action: "approve",
            note: "Test approval auto-project"
        });

        console.log("Approve response:", approveRes.status, approveRes.data);

        console.log("\n5. Checking if project was created...");
        const projRes = await makeRequest("GET", "/api/projects");
        if (projRes.status === 200) {
            const projs = projRes.data.data || projRes.data;
            const myProj = projs.find(p => p.invoiceId === q.id);
            if (myProj) {
                console.log("✅ SUCCESS! Project found!", myProj.name);
            } else {
                console.log("❌ Project not found containing invoice_id:", q.id);
            }
        }

    } else {
        console.log("No pending quotations found. We cannot test the approval flow right now.");
    }
}

testProjectCreation().catch(console.error);
