import { getAuthHeader } from "./client/src/lib/queryClient";

async function run() {
    const res = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@webexcels.com", password: "admin" })
    });
    const data = await res.json();
    console.log("Login:", data);
    if (!data.token) {
        console.log("No token, try another pwd");
        const res2 = await fetch("http://localhost:5000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "admin@webexcels.com", password: "admin123" })
        });
        const data2 = await res2.json();
        console.log("Login2:", data2);
        if (data2.token) {
            const roleRes = await fetch("http://localhost:5000/api/settings/roles", {
                headers: { "Authorization": `Bearer ${data2.token}` }
            });
            console.log("Roles:", await roleRes.json());
        }
    } else {
        const roleRes = await fetch("http://localhost:5000/api/settings/roles", {
            headers: { "Authorization": `Bearer ${data.token}` }
        });
        console.log("Roles:", await roleRes.json());
    }
}
run();
