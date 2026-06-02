const fs = require('fs');
let content = fs.readFileSync('client/src/pages/lead-manager-dashboard.tsx', 'utf8');

// First replace
const target1 = '{systemUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}';
const repl1 = '{systemUsers.filter((u: any) => u.role === "sales_executive").map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}';
content = content.replace(target1, repl1);

// Second replace
const target2 = '{systemUsers.map((u: any) => (\r\n                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.username})</option>\r\n                        ))}';
const repl2 = '{systemUsers.filter((u: any) => u.role === "sales_executive").map((u: any) => (\n                          <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>\n                        ))}';

// If CRLF vs LF issue, use regex or replace across line breaks
content = content.replace(/\{systemUsers\.map\(\(u: any\) => \([\s\S]*?<option key=\{u\.id\} value=\{u\.id\}>\{u\.firstName\} \{u\.lastName\} \(\{u\.username\}\)<\/option>[\s\S]*?\)\)\}/, repl2);

fs.writeFileSync('client/src/pages/lead-manager-dashboard.tsx', content);
console.log('Patched');
