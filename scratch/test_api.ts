import { authService } from "../server/auth.service";

async function main() {
  const userId = "4fec24fc-8c7a-4066-8126-578f66164d00"; // Haider
  const token = authService.generateToken({ userId, roleId: "sales_executive", email: "haider@test.com", roles: ["sales_executive"] });
  
  const from = "2026-04-15";
  const to = "2026-05-15";
  const url = `http://localhost:5000/api/reports/loan?from=${from}&to=${to}&userId=${userId}`;
  
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

main();
