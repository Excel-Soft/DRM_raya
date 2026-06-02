import jwt from 'jsonwebtoken';
import { customersRepository } from '../server/repositories/customers.repository';
import { resolveUserId, normalizeRole } from '../server/utils/role-utils';

const secret = process.env.JWT_SECRET || 'fallback_secret_keep_it_safe_in_prod';
const token = jwt.sign({ 
  id: '96b90776-3ebd-4fe5-9615-03484eda945f', 
  email: 'testuser@example.com', 
  roles: ['sales_executive'],
  roleId: 'sales_executive'
}, secret);

const payload = jwt.verify(token, secret);
const userId = payload.id || payload.userId;
const roleId = payload.roleId;

async function run() {
  const result = await customersRepository.findByUserId(userId, {}, roleId);
  const haider3 = result.customers.filter((c: any) => c.companyName === 'haider');
  console.log('Result:', JSON.stringify(haider3, null, 2));
  process.exit(0);
}
run();
