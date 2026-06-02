const fs = require('fs');

let c = fs.readFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-executive-dashboard.tsx', 'utf8');

c = c.replace(
  'body: JSON.stringify({ ownerUserId: null }),',
  'body: JSON.stringify({ status: "To Distribute" }),'
);

c = c.replace(
  /allLeads\.filter\(\(l: any\) => l\.ownerUserId\)/g,
  'allLeads.filter((l: any) => l.ownerUserId && l.status !== "To Distribute")'
);

c = c.replace(
  /allLeads\.filter\(\(l: any\) => !l\.ownerUserId\)/g,
  'allLeads.filter((l: any) => l.ownerUserId && l.status === "To Distribute")'
);

// We need to replace the mutationFn and onSuccess of assignToSelfMutation
c = c.replace(
  /mutationFn: async \(leadId: string\) => \{\s*const res = await fetch\(`\/api\/sales\/leads\/\$\{leadId\}\/assign`, \{\s*method: "POST",\s*\}\);\s*if \(!res\.ok\) throw new Error\("Failed to assign lead"\);\s*return res\.json\(\);\s*\},\s*onSuccess: \(\) => \{\s*toast\(\{ title: "Success", description: "Lead assigned successfully\. Check Today Follow\." \}\);\s*queryClient\.invalidateQueries\(\{ queryKey: \["\/api\/customers\?pageSize=1000"\] \}\);\s*setFollowActiveTab\("follow"\);\s*\}/,
  `mutationFn: async (leadId: string) => {
      const res = await fetch(\`/api/sales/leads/\${leadId}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId: null, status: "Manager Distribute" }),
      });
      if (!res.ok) throw new Error("Failed to forward lead to manager");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Lead forwarded to Lead Manager." });
      queryClient.invalidateQueries({ queryKey: ["/api/customers?pageSize=1000"] });
    }`
);

fs.writeFileSync('c:/webexcel/WebExcelsDRM/client/src/pages/lead-executive-dashboard.tsx', c);
console.log("Updated lead-executive-dashboard.tsx");
