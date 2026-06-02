const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
  try {
    const res = await client.query("SELECT name, is_active, allowed_role_ids FROM drm.menu_permissions WHERE name IN ('Admin', 'DRM Setting')");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (e) {
    console.error(e);
  }
  client.end();
}).catch(e => console.error(e.message));
