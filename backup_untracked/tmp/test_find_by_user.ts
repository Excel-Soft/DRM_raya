import { CustomersRepository } from '../server/repositories/customers.repository';
async function run() {
    const repo = new CustomersRepository();
    // This ID matches the one found in the database for 'mosin'
    const userId = '512a8be4-e78c-4f7d-afbb-8c6740007ba5';
    const roleId = 'sales_executive';
    try {
        const result = await repo.findByUserId(userId, { search: 'mosin' }, roleId);
        console.log('Total:', result.total);
        console.table(result.customers.map(c => ({ 
            id: c.id, 
            companyName: c.companyName, 
            ownerUserId: c.ownerUserId,
            isTemp: (c as any).isTemp
        })));
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
