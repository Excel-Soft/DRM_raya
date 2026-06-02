import { pool } from '../server/db';
import { authService } from '../server/auth.service';
import { normalizeRole } from '../server/utils/role-utils';

async function run() {
  const res1 = await pool.query("select * from drm.users where email='admin@excelstech.com' limit 1");
  if (res1.rows.length === 0) throw new Error('admin not found');
  const user1 = res1.rows[0];
  const token1 = authService.generateToken({ userId: user1.id, email: user1.email, roleId: normalizeRole(user1.role), roles: user1.roles, activeRoleId: normalizeRole(user1.role), branch: '', country: '' });
  
  const res2 = await pool.query("select * from drm.users where email='testuser@example.com' limit 1");
  const user2 = res2.rows[0];
  const token2 = authService.generateToken({ userId: user2.id, email: user2.email, roleId: normalizeRole(user2.role), roles: user2.roles, activeRoleId: normalizeRole(user2.role), branch: '', country: '' });
  
  const h1 = await fetch('http://localhost:5000/api/sales/customers', { headers: { Authorization: `Bearer ${token1}` } }).then(r => r.json());
  console.log('user1 customers:', h1.data?.length);
  
  const h2 = await fetch('http://localhost:5000/api/sales/customers', { headers: { Authorization: `Bearer ${token2}` } }).then(r => r.json());
  console.log('user2 customers:', h2.data?.length);
  process.exit(0);
}

run().catch(console.error);
