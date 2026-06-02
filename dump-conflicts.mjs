import fs from 'fs';
const data = fs.readFileSync('c:/WebExcelsDRM/server/services/rbac.service.ts', 'utf8');
fs.writeFileSync('c:/WebExcelsDRM/logs2.md', data);
const data2 = fs.readFileSync('c:/WebExcelsDRM/server/utils/role-utils.ts', 'utf8');
fs.writeFileSync('c:/WebExcelsDRM/logs3.md', data2);
