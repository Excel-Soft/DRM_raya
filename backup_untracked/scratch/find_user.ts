import { pool } from '../server/db'; 
async function run() { 
    try {
        const res = await pool.query("select id, username, name, full_name, role from users where username ilike '%fakhar%' or name ilike '%fakhar%' or full_name ilike '%fakhar%'"); 
        console.log(JSON.stringify(res.rows, null, 2)); 
    } catch(e) {
        console.error(e);
    }
    process.exit(0); 
} 
run();
