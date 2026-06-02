import { pool } from "../server/db";
import { authService } from "../server/auth.service";

async function run() {
    const userRes = await pool.query("select id, email, role, full_name from drm.users where email = 'talhaexcelstech@gmail.com' limit 1");
    const user = userRes.rows[0];

    const token = authService.generateToken({
        userId: user.id,
        email: user.email,
        roleId: user.role,
        roles: [user.role],
        activeRoleId: user.role,
        branch: "",
        country: "",
    });

    const res = await fetch("http://localhost:5000/api/settings/roles", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "brand_new_role", description: "testing 123" })
    });

    const parsed = await res.json();
    console.log("Status:", res.status);
    console.log("Result:", parsed);

    process.exit(0);
}
run();
