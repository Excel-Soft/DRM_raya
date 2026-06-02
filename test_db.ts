import { pool } from './server/db.ts';

pool.query("SELECT id, company_name, owner_user_id, pool_type, status FROM drm.customers")
  .then(res => {
    console.log('TOTAL:', res.rows.length);
    console.log('UNASSIGNED:', res.rows.filter(r => !r.owner_user_id).length);
    const qwen = res.rows.find(r => r.company_name === 'qwen-tech');
    console.log('qwen-tech lead:', qwen);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
