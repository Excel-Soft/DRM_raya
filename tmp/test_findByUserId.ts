import { customersRepository } from '../server/repositories/customers.repository'; async function run() { 
  const res = await customersRepository.findByUserId('0b40b09a-c887-4e47-9098-09dd6e6346fa', {}, 'sales_executive');
  console.log(res.customers.filter(c => c.companyName === 'haider'));
  process.exit(0); 
} run();
