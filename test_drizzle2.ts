import { db } from './server/db.ts';
import { customers } from './shared/schema.ts';
import { isNull } from 'drizzle-orm';

db.select().from(customers).where(isNull(customers.ownerUserId)).then(res => {
  console.log('UNASSIGNED LEADS:', res.map(l => l.companyName));
  process.exit(0);
}).catch(console.error);
