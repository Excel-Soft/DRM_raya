const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

client.connect().then(() => {
    return client.query("SELECT 1 WHERE '23d26e73-9afc-4726-a5a8-16a6d0a859bd'::uuid = ANY($1::uuid[])", [['23d26e73-9afc-4726-a5a8-16a6d0a859bd']]);
}).then(res => {
    console.log("OK", res.rows);
}).catch(err => {
    console.error("ERROR", err.message);
}).finally(() => {
    client.end();
});
