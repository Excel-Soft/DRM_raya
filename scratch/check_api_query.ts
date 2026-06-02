import { pool } from "../server/db";

async function check() {
    const from = new Date("2026-05-18");
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(from.getDate() + 1);
    
    console.log("From:", from.toISOString());
    console.log("To:", to.toISOString());

    const res = await pool.query(`
        select m.id, m.start_time, m.user_id, u.name 
        from drm.meetings m
        left join drm.users u on u.id = m.user_id
        where m.start_time >= $1
        and m.start_time < $2
        and m.meeting_type = 'Team Meeting'
        order by m.start_time desc
    `, [from, to]);
    console.log(res.rows);
    process.exit(0);
}

check();
