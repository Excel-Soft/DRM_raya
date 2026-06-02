const fs = require('fs');
let c = fs.readFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', 'utf8');

c = c.replace('const [tagSearch, setTagSearch] = useState("");', 'const [tagSearch, setTagSearch] = useState("");\n  const [leadSearch, setLeadSearch] = useState("");');

c = c.replace('const allLeads = customersData?.customers || [];', 'const allLeads = customersData?.customers || [];\n  const filteredLeads = allLeads.filter((lead) => \n    !leadSearch || \n    lead.companyName?.toLowerCase().includes(leadSearch.toLowerCase()) ||\n    lead.country?.toLowerCase().includes(leadSearch.toLowerCase()) ||\n    lead.city?.toLowerCase().includes(leadSearch.toLowerCase()) ||\n    lead.createdBy?.toLowerCase().includes(leadSearch.toLowerCase()) ||\n    lead.ownerUserId?.toLowerCase().includes(leadSearch.toLowerCase())\n  );');

c = c.replace('Search: <Input className="h-10 w-52 rounded-xl border-slate-200 bg-slate-50/60 shadow-none dark:border-zinc-800" />', 'Search: <Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} className="h-10 w-52 rounded-xl border-slate-200 bg-slate-50/60 shadow-none dark:border-zinc-800" placeholder="Search leads..." />');

c = c.replace('allLeads.length === 0 ? (', 'filteredLeads.length === 0 ? (');
c = c.replace('No leads found in the system. Add some to get started!', 'No leads found matching your search. Add some to get started!');
c = c.replace('allLeads.map((lead: any, idx: number) => {', 'filteredLeads.map((lead: any, idx: number) => {');
c = c.replace('Showing 1 to {allLeads.length} of {allLeads.length} entries', 'Showing 1 to {filteredLeads.length} of {filteredLeads.length} entries');
c = c.replace('<span className="text-slate-900 text-[28px] ml-1 dark:text-zinc-100">{allLeads.length}</span>', '<span className="text-slate-900 text-[28px] ml-1 dark:text-zinc-100">{filteredLeads.length}</span>');

fs.writeFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-manager-dashboard.tsx', c);
