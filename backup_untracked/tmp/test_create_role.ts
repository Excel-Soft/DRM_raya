import { getAuthHeader } from "./client/src/lib/queryClient";

async function run() {
    const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "talhaexcelstech@gmail.com", password: "admin" })
    });
    const data = await res.json();
    console.log("Login:", data);

    if (data.token) {
        const createRoleRes = await fetch("http://localhost:5000/api/settings/roles", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.token}`
            },
            body: JSON.stringify({ name: "test_role", description: "Test role" })
        });

        console.log("Create role status:", createRoleRes.status);
        const result = await createRoleRes.json();
        console.log("Create role response:", result);
    }
}
run();
