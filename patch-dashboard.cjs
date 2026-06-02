const fs = require('fs');

let c = fs.readFileSync('server/dashboard-routes.ts', 'utf8');

c = c.replace(
    /\/\/ We need a way to look up roles for each user in the activity rows[\s\S]*?const rows = activityRows\.rows\.map\(\(row\) => \{\s*const key = row\.user_id \?\? "unknown";/,
    `// We need a way to look up roles for each user
      let displayUsers: any[] = [];
      if (isManager && allowedUserIds) {
          const uRes = await pool.query(\`SELECT id::text as user_id, coalesce(full_name, name, username) as name, role FROM drm.users WHERE id = ANY($1::uuid[])\`, [allowedUserIds]);
          displayUsers = uRes.rows;
      } else {
          const uRes = await pool.query(\`SELECT id::text as user_id, coalesce(full_name, name, username) as name, role FROM drm.users WHERE id = $1::uuid\`, [userId]);
          displayUsers = uRes.rows;
      }

      const activityMap = activityRows.rows.reduce<Record<string, any>>((acc, row) => {
          if (row.user_id) acc[row.user_id] = row;
          return acc;
      }, {});

      const rows = displayUsers.map((uRow) => {
        const key = uRow.user_id;
        const row = activityMap[key] || {};`
);

c = c.replace(
    /const userRole = userRolesMap\[key\];/,
    `const userRole = (uRow.role || "").toLowerCase().replace(/_/g, ' ');`
);

c = c.replace(
    /userId: row\.user_id,\s*name: row\.name \?\? "Unknown",/,
    `userId: key,\n          name: uRow.name ?? "Unknown",`
);

fs.writeFileSync('server/dashboard-routes.ts', c);
console.log('Done!');
