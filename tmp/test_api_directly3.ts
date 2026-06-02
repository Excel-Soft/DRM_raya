import jwt from 'jsonwebtoken';
const secret = process.env.JWT_SECRET || 'fallback_secret_keep_it_safe_in_prod';
const token = jwt.sign({ 
  id: '0b40b09a-c887-4e47-9098-09dd6e6346fa', 
  email: 'admin@excelstech.com', 
  roles: ['sales_executive'],
  roleId: 'sales_executive'
}, secret);

async function run() {
  const res = await fetch('http://localhost:5000/api/sales/customers', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const json = await res.json();
  const haider3 = json.customers ? json.customers.filter((c: any) => c.companyName === 'haider') : [];
  console.log('Result for AHMED over HTTP:', haider3.length);
  process.exit(0);
}
run();
