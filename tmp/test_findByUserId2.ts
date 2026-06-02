import { customersRepository } from '../server/repositories/customers.repository'; async function run() { 
  const res = await customersRepository.findByUserId('96b90776-3ebd-4fe5-9615-03484eda945f', {}, 'sales_executive');
  console.log(res.customers.filter(c => c.companyName === 'haider'));
  process.exit(0); 
} run();
