import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'fallback_secret_keep_it_safe_in_prod';
const token = jwt.sign({ 
  id: '96b90776-3ebd-4fe5-9615-03484eda945f', 
  email: 'testuser@example.com', 
  roles: ['sales_executive'],
  roleId: 'sales_executive'
}, secret);

async function run() {
  const res = await fetch('http://localhost:5000/api/sales/customers', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  const haider3 = json.customers ? json.customers.filter((c: any) => c.companyName === 'haider') : [];
  console.log('Result:', JSON.stringify(haider3, null, 2));
  process.exit(0);
}
run();
