const fs = require('fs');

let c = fs.readFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', 'utf8');

const regex = /<select \s*className="h-8 border border-slate-200 rounded text-xs px-2 w-32 outline-none dark:border-zinc-800"[\s\S]*?onChange=\{e => setAssigningUserId\(\{ \.\.\.assigningUserId, \[lead\.id\]: e\.target\.value \}\)\}[\s\S]*?>[\s\S]*?<option value="">Select Exec<\/option>[\s\S]*?\{systemUsers\.filter\(\(u: any\) => u\.role === "sales_executive"\)\.map\(\(u: any\) => <option key=\{u\.id\} value=\{u\.id\}>\{u\.fullName\}<\/option>\)\}[\s\S]*?<\/select>/g;

const replacement = `<select 
                                  className="h-8 border border-slate-200 rounded text-xs px-2 w-[160px] outline-none dark:border-zinc-800"
                                  value={assigningUserId[lead.id] || ""}
                                  onChange={e => setAssigningUserId({ ...assigningUserId, [lead.id]: e.target.value })}
                                >
                                  <option value="">Select Exec</option>
                                  <optgroup label="Sales Executives">
                                    {systemUsers.filter((u: any) => u.role === "sales_executive").map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </optgroup>
                                  <optgroup label="Service Executives">
                                    {systemUsers.filter((u: any) => u.role === "service_executive").map((u: any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                  </optgroup>
                                </select>`;

if (regex.test(c)) {
  c = c.replace(regex, replacement);
  fs.writeFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', c);
  console.log("Updated lead-manager-dashboard select.");
} else {
  console.log("Regex not found in lead-manager-dashboard.tsx");
}

