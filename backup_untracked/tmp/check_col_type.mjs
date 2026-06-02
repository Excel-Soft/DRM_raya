import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

async function checkColumnType() {
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'url_permissions' AND table_schema = 'drm'");
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkColumnType();
