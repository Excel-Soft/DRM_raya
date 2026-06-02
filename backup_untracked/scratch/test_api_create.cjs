
const fetch = require('node-fetch');

async function testApiCreate() {
  const newUser = {
    fullName: "umer",
    email: "umer@excelstech.com",
    password: "password123",
    role: "software_manager",
    roles: ["software_manager"],
    branch: "Lahore Gulburg",
    country: "Pakistan"
  };

  try {
    const res = await fetch('http://localhost:5000/api/users', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // We need a token because it's protected. I'll assume the server has MOCK_AUTH=true for now or I'll just see the error.
        'x-mock-user-email': 'admin@webexcels.com'
      },
      body: JSON.stringify(newUser)
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err.message);
  }
}

testApiCreate();
