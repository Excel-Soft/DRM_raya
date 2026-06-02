async function run() {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZWE2NjU2YS1iZWQzLTQ1NDktYjYwZC1jYmE4NDdjMWM1YWIiLCJlbWFpbCI6InRhbGhhZXhjZWxzdGVjaEBnbWFpbC5jb20iLCJyb2xlSWQiOiJhZG1pbiIsInJvbGVzIjpbImFkbWluIl0sImFjdGl2ZVJvbGVJZCI6ImFkbWluIiwiYnJhbmNoIjoiIiwiY291bnRyeSI6IiIsImlhdCI6MTc3MjgwNjA2MCwiZXhwIjoxNzczNDEwODYwfQ.Xgtricqel2xMoQRp_R5UU8XPqa89WNGs3UIsbpaVaDk";

    const res = await fetch("http://localhost:5000/api/users", {
        headers: { "Cookie": `auth_token=${token}` }
    });
    const json = await res.json() as any;
    console.log("Users roles:");
    for (const u of (json.users || [])) {
        console.log(`  ${u.fullName || u.email}: role="${u.role}", roles=${JSON.stringify(u.roles)}`);
    }

    const res2 = await fetch("http://localhost:5000/api/settings/roles", {
        headers: { "Cookie": `auth_token=${token}` }
    });
    const roles = await res2.json() as any[];
    console.log("\nRoles from /api/settings/roles:");
    for (const r of roles) {
        console.log(`  id=${r.id}, name=${r.name}`);
    }
}

run();
