require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('leave_requests', 'loan_requests', 'overtime_records')")
    .then(res => console.log(JSON.stringify(res.rows, null, 2)))
    .catch(err => console.error(err.message))
    .finally(() => process.exit(0));
