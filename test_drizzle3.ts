import { db } from './server/db.ts';
import { users } from './shared/schema.ts';

db.select().from(users).limit(1).then(res => {
  console.log(res[0]);
  process.exit(0);
}).catch(console.error);
