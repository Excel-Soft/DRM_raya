import { pool } from './server/db';
pool.query("SELECT allowed_role_ids FROM drm.url_permissions WHERE path = 'tasks'").then(res => { 
  console.log(res.rows); 
  process.exit(0); 
}).catch(console.error);
