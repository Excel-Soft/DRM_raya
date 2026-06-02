const { Pool } = require('pg'); 
const pool = new Pool({ connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres' }); 
pool.query('SELECT id, project_id, title FROM drm.tasks ORDER BY created_at DESC LIMIT 5').then(res => { console.log(res.rows); process.exit(0); }).catch(console.error);
