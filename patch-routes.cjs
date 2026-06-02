const fs = require('fs');

let s = fs.readFileSync('server/dashboard-routes.ts', 'utf8');

const patches = [
  {
    regex: /const isManager = isManagerRole\(\(\(req\.user as any\)\.activeRoleId \|\| req\.user\.roleId\)\);\r?\n\s*const userId = req\.user\.userId;\r?\n\r?\n\s*const activityParams: any\[\] = \[from, to\];\r?\n\s*let activityFilter = "";\r?\n\s*if \(!isManager\) \{\r?\n\s*activityFilter = ` and a\.created_by = \$\$\{activityParams\.length \+ 1\}::uuid`;\r?\n\s*activityParams\.push\(userId\);\r?\n\s*\}/,
    replacement: `const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));
      const userId = req.user.userId;
      const allowedUserIds = await getDepartmentFilterUserIds(req);

      const activityParams: any[] = [from, to];
      let activityFilter = "";
      if (!isManager) {
        activityFilter = \` and a.created_by = $\${activityParams.length + 1}::uuid\`;
        activityParams.push(userId);
      } else if (allowedUserIds) {
        activityFilter = \` and a.created_by = ANY($\${activityParams.length + 1})\`;
        activityParams.push(allowedUserIds);
      }`
  },
  {
    regex: /const apptParams: any\[\] = \[from, to\];\r?\n\s*let apptFilter = "";\r?\n\s*if \(!isManager\) \{\r?\n\s*apptFilter = ` and ap\.assigned_to = \$\$\{apptParams\.length \+ 1\}::uuid`;\r?\n\s*apptParams\.push\(userId\);\r?\n\s*\}/,
    replacement: `const apptParams: any[] = [from, to];
      let apptFilter = "";
      if (!isManager) {
        apptFilter = \` and ap.assigned_to = $\${apptParams.length + 1}::uuid\`;
        apptParams.push(userId);
      } else if (allowedUserIds) {
        apptFilter = \` and ap.assigned_to = ANY($\${apptParams.length + 1})\`;
        apptParams.push(allowedUserIds);
      }`
  },
  {
    regex: /const customerParams: any\[\] = \[from, to\];\r?\n\s*let customerFilter = "";\r?\n\s*if \(!isManager\) \{\r?\n\s*customerFilter = ` and coalesce\(c\.owner_user_id::text, c\.created_by::text\) = \$\$\{customerParams\.length \+ 1\}::text`;\r?\n\s*customerParams\.push\(userId\);\r?\n\s*\}/,
    replacement: `const customerParams: any[] = [from, to];
      let customerFilter = "";
      if (!isManager) {
        customerFilter = \` and coalesce(c.owner_user_id::text, c.created_by::text) = $\${customerParams.length + 1}::text\`;
        customerParams.push(userId);
      } else if (allowedUserIds) {
        customerFilter = \` and coalesce(c.owner_user_id::text, c.created_by::text) = ANY($\${customerParams.length + 1})\`;
        customerParams.push(allowedUserIds);
      }`
  }
];

patches.forEach(p => {
  s = s.replace(p.regex, p.replacement);
});

fs.writeFileSync('server/dashboard-routes.ts', s);
console.log('patched activities endpoint');
