import { pool } from './server/db.ts';

pool.query("UPDATE drm.customers SET owner_user_id = NULL WHERE company_name = 'qwen-tech' RETURNING id, owner_user_id")
  .then(res => {
    console.log('UPDATED:', res.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
