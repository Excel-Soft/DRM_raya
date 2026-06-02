const fs = require('fs');
let content = fs.readFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', 'utf8');

const regex = /<select className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-\[12px\] font-semibold text-slate-700 outline-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">[\s\S]*?<option>TD<\/option>[\s\S]*?<\/select>/g;

content = content.replace(regex, `<select value={topSellingFilter} onChange={(e) => setTopSellingFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 outline-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">\n                <option value="TD">TD</option>\n                <option value="1W">1W</option>\n                <option value="1M">1M</option>\n              </select>`);

fs.writeFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', content);
console.log("Replaced with regex.");
