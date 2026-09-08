import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";
const base = "http://localhost:5000";
const admin = {
  userId: "04921d75-955f-4828-b7c5-dca525aa3d1e",
  email: "admin@webexcels.local",
  roleId: "admin",
  roles: ["admin"],
  activeRoleId: "admin",
  branch: "",
  country: "",
};
const token = jwt.sign(admin, SECRET, { expiresIn: "1h" });
const AUTH = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const NOAUTH = { "Content-Type": "application/json" };

async function hit(method, path, body, headers = AUTH) {
  try {
    const res = await fetch(base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let txt = await res.text();
    if (txt.length > 320) txt = txt.slice(0, 320) + "…";
    console.log(`${method} ${path} -> ${res.status} ${txt}`);
  } catch (e) {
    console.log(`${method} ${path} -> ERROR ${e.message}`);
  }
}

console.log("=== 1-3. bridge reports authed (expect 200 {targetModule,items:[],summary}) ===");
await hit("GET", "/api/service/gm-report");
await hit("GET", "/api/service/vas-report");
await hit("GET", "/api/service/bv-report");

console.log("\n=== 4. report unauth (expect 401) ===");
await hit("GET", "/api/service/bv-report", null, NOAUTH);

console.log("\n=== 5-7. bridge writes disabled by default (expect 403 'Service bridge is not enabled') ===");
await hit("POST", "/api/service/gm", { serviceCustomerId: "nonexistent" });
await hit("POST", "/api/service/vas", { serviceCustomerId: "nonexistent" });
await hit("POST", "/api/service/bv", { serviceCustomerId: "nonexistent" });

console.log("\n=== 8. bridge write unauth (expect 401) ===");
await hit("POST", "/api/service/bv", { serviceCustomerId: "x" }, NOAUTH);

console.log("\n=== 9-12. dashboards (expect 200, honest numbers) ===");
await hit("GET", "/api/service/manager/stats");
await hit("GET", "/api/service/manager/queue-performance");
await hit("GET", "/api/service/manager/current-month-graph");
await hit("GET", "/api/service/executive/stats");

console.log("\n=== 13. validator probe: followup create with empty body (expect 400/403) ===");
await hit("POST", "/api/service/followups", {});
