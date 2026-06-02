
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testCreateUser() {
  try {
    const data = {
        fullName: "test user",
        email: "test_create@excelstech.com",
        password: "password123",
        role: "software_manager",
        roles: ["software_manager"],
        branch: "Lahore Gulburg",
        country: "Pakistan"
    };
    
    // Set search path
    await pool.query("SET search_path TO drm, public");

    const query = `insert into users 
       (full_name, name, email, username, password_hash, password, role, role_id, roles, branch, country, 
        department, designation, phone, is_active, 
        first_name, father_husband_name, attendance_id, guardian_mobile, passport_cnic, facebook_id, 
        date_of_birth, join_date, role_type, under_works, 
        basic_salary, daily_allowance, mobile_allowance, admin_allowance, conveyance_allowance, 
        relaxation_minutes, increment, gender, address, 
        created_at, updated_at) 
       values ($1, $1, $2, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, now(), now()) 
       returning id`;
       
    const values = [
      data.fullName,                          // $1
      data.email,                             // $2
      "hash",                                 // $3
      data.password,                          // $4
      data.role,                              // $5
      data.roles,                             // $6
      data.branch,                            // $7
      data.country,                           // $8
      null, null, null, true, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
    ];

    const res = await pool.query(query, values);
    console.log("Success:", res.rows[0].id);
  } catch (err) {
    console.error("Error:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
  } finally {
    await pool.end();
  }
}

testCreateUser();
