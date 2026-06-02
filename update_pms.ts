import { pool } from './server/db';
pool.query("UPDATE drm.url_permissions SET allowed_role_ids = array_append(allowed_role_ids, 'posting_executive') WHERE path = 'pms' AND NOT ('posting_executive' = ANY(allowed_role_ids))").then(() => { 
  console.log('Done'); 
  process.exit(0); 
}).catch(console.error);
