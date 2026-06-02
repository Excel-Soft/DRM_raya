import { queryClient, apiRequest } from "./client/src/lib/queryClient";

async function run() {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5ZWE2NjU2YS1iZWQzLTQ1NDktYjYwZC1jYmE4NDdjMWM1YWIiLCJlbWFpbCI6InRhbGhhZXhjZWxzdGVjaEBnbWFpbC5jb20iLCJyb2xlSWQiOiJhZG1pbiIsInJvbGVzIjpbImFkbWluIl0sImFjdGl2ZVJvbGVJZCI6ImFkbWluIiwiYnJhbmNoIjoiIiwiY291bnRyeSI6IiIsImlhdCI6MTc3MjgwNjA2MCwiZXhwIjoxNzczNDEwODYwfQ.Xgtricqel2xMoQRp_R5UU8XPqa89WNGs3UIsbpaVaDk";

    const res = await fetch("http://localhost:5000/api/sales/customers", {
        headers: {
            "Cookie": `auth_token=${token}`
        }
    });
    const json = await res.json();
    console.log("Customers response:", JSON.stringify(json, null, 2));
}

run();
