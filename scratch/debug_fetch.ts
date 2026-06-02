import { authService } from "../server/auth.service";

async function run() {
    const payload = {
        userId: "6d406b3c-4055-4c8c-b421-9367f187a672",
        email: "haider@excelstech.com",
        roleId: "sales_executive",
        roles: ["sales_executive"],
        branch: "Main",
        country: "PK"
    };

    const token = authService.generateToken(payload as any);

    try {
        const res = await fetch("http://localhost:5000/api/sales/targets/ab", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.text();
        console.log("Status:", res.status);
        console.log("Data:", data);
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}
run();
