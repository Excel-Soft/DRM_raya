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

    console.log("Token generated:", token);

    const res = await fetch("http://localhost:5000/api/settings/roles", {
        headers: { "Authorization": `Bearer ${token}` }
    });

    const parsed = await res.json();
    console.log("Status:", res.status);
    console.log("Roles fetched:", parsed);

    process.exit(0);
}
run();
