const fs = require('fs');
let s = fs.readFileSync('server/dashboard-routes.ts', 'utf8');

// Fix summary block
const sumSearch = '      const period = String(req.query.period ?? "MONTH").toUpperCase();\n      const { from, to } = getPeriodRange(period);\n      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));\n      const userId = req.user.userId;\n\n      // Revenue from GM Entries (Approved)\n      const gmParams: any[] = [from, to];\n      let gmFilter = "";\n      if (!isManager) {\n        gmFilter = ` and created_by::text = $${gmParams.length + 1}::text`;\n        gmParams.push(userId);\n      }';
const sumSearch2 = sumSearch.replace(/\n/g, '\r\n');
const sumReplace = '      const period = String(req.query.period ?? "MONTH").toUpperCase();\n      const { from, to } = getPeriodRange(period);\n      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));\n      const userId = req.user.userId;\n      const allowedUserIds = await getDepartmentFilterUserIds(req);\n\n      // Revenue from GM Entries (Approved)\n      const gmParams: any[] = [from, to];\n      let gmFilter = "";\n      if (!isManager) {\n        gmFilter = ` and created_by::text = $${gmParams.length + 1}::text`;\n        gmParams.push(userId);\n      } else if (allowedUserIds) {\n        gmFilter = ` and created_by::text = ANY($${gmParams.length + 1})`;\n        gmParams.push(allowedUserIds);\n      }';
s = s.replace(sumSearch, sumReplace);
s = s.replace(sumSearch2, sumReplace.replace(/\n/g, '\r\n'));

// Fix duplicate allowedUserIds
const dupSearch = '      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));\n      const userId = req.user.userId;\n      const allowedUserIds = await getDepartmentFilterUserIds(req);\n      const allowedUserIds = await getDepartmentFilterUserIds(req);\n      const allowedUserIds = await getDepartmentFilterUserIds(req);';
const dupSearch2 = dupSearch.replace(/\n/g, '\r\n');
const dupReplace = '      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));\n      const userId = req.user.userId;\n      const allowedUserIds = await getDepartmentFilterUserIds(req);';
s = s.replace(dupSearch, dupReplace);
s = s.replace(dupSearch2, dupReplace.replace(/\n/g, '\r\n'));

fs.writeFileSync('server/dashboard-routes.ts', s);
console.log('Fixed');
