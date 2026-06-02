const fs = require('fs');

let c = fs.readFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', 'utf8');

const selectFind = '<select className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 outline-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">\n                <option>TD</option>\n              </select>';

const selectReplace = `<select value={topSellingFilter} onChange={(e) => setTopSellingFilter(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 outline-none shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                <option value="TD">TD</option>
                <option value="1W">1W</option>
                <option value="1M">1M</option>
              </select>`;

c = c.replace(selectFind, selectReplace);

const calcFind = `  // Calculate Totals for Top Selling
  const totalLeadsCount = allLeads.length;
  const distributedLeadsCount = allLeads.filter((l: any) => l.ownerUserId).length;
  const distributeLeadsCount = allLeads.filter((l: any) => !l.ownerUserId).length;`;

const calcReplace = `  // Calculate Totals for Top Selling
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
  const distributeLeadsCount = topSellingLeads.filter((l: any) => !l.ownerUserId).length;`;

c = c.replace(calcFind, calcReplace);

fs.writeFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', c);
console.log("Updated lead-manager-dashboard.tsx");
