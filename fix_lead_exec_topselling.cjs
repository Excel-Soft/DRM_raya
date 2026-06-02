const fs = require('fs');
let c = fs.readFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-executive-dashboard.tsx', 'utf8');

// 1. Add topSellingFilter state
c = c.replace(
  'const [followActiveTab, setFollowActiveTab] = useState<"follow" | "distribute">("follow");',
  'const [followActiveTab, setFollowActiveTab] = useState<"follow" | "distribute">("follow");\n  const [topSellingFilter, setTopSellingFilter] = useState("TD");'
);

// 2. Add calculate logic
const calcRegex = /const incompleteLeads = allLeads\.filter\(\(l: any\) => !l\.companyName \|\| !l\.email \|\| !l\.phone \|\| !l\.city \|\| l\.email === "-" \|\| l\.phone === "-"\);/;
c = c.replace(calcRegex, `const incompleteLeads = allLeads.filter((l: any) => !l.companyName || !l.email || !l.phone || !l.city || l.email === "-" || l.phone === "-");

  const now = new Date();
  const topSellingLeads = allLeads.filter((lead: any) => {
    if (!lead.createdAt) return false;
    const createDate = new Date(lead.createdAt);
    if (topSellingFilter === "TD") {
      return createDate.toDateString() === now.toDateString();
    } else if (topSellingFilter === "1W") {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return createDate >= oneWeekAgo;
    } else if (topSellingFilter === "1M") {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return createDate >= oneMonthAgo;
    }
    return true;
  });

  const totalLeadsCount = topSellingLeads.length;
  const distributedLeadsCount = topSellingLeads.filter((l: any) => l.ownerUserId).length;
  const distributeLeadsCount = topSellingLeads.filter((l: any) => !l.ownerUserId).length;`);

// 3. Replace select
const selectRegex = /<select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-\[12px\] font-semibold text-slate-700 outline-none w-20 cursor-pointer hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400">[\s\S]*?<\/select>/;
c = c.replace(selectRegex, `<select value={topSellingFilter} onChange={(e) => setTopSellingFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 outline-none w-20 cursor-pointer hover:bg-slate-50 transition-colors dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400">
                  <option value="TD">TD</option>
                  <option value="1W">1W</option>
                  <option value="1M">1M</option>
                </select>`);

// 4. Replace CardContent empty area
const cardContentRegex = /<CardContent className="p-0">\s*\{\/\* Empty Area based on the screenshot \*\/\}\s*<div className="py-2" \/>\s*<\/CardContent>/;
c = c.replace(cardContentRegex, `<CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
                {([ ["Total Lead", Users, totalLeadsCount], ["Distribute", ArrowRightLeft, distributeLeadsCount], ["Distributed", Tag, distributedLeadsCount] ] as [string, React.ElementType, number][]).map(([l, Icon, count], i) => (
                  <div key={i} className="group relative overflow-hidden rounded-[22px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfa_100%)] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] dark:border-zinc-800">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00a65a] via-[#37c982] to-[#8be0b3] opacity-80" />
                    <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-2">
                      <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-slate-400">{l}</p>
                      <p className="text-[42px] font-bold leading-none text-slate-800 dark:text-zinc-100">{count}</p>
                      <p className="text-[12px] text-slate-400">Updated {topSellingFilter === "TD" ? "for today" : topSellingFilter === "1W" ? "this week" : "this month"}</p>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#00a65a_0%,#0f9f73_100%)] text-white shadow-[0_12px_24px_rgba(0,166,90,0.25)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    </div>
                  </div>
                ))}
              </CardContent>`);

fs.writeFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-executive-dashboard.tsx', c);
console.log("Lead Executive Dashboard Top Selling fixed!");
