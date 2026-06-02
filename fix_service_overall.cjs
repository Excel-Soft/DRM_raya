const fs = require('fs');

let c = fs.readFileSync('c:/webexcel/WebExcelsDRM/server/service-executive-routes.ts', 'utf8');

// Add import if not present
if (!c.includes('opportunitiesRepository')) {
  c = c.replace(
    'import { computeExpiryState } from "./utils/service-expiry";',
    'import { computeExpiryState } from "./utils/service-expiry";\nimport { opportunitiesRepository } from "./repositories/opportunities.repository";'
  );
}

// Replace overall array
const overallRegex = /const overall = \[\s*\{ name: "LD", value: 0 \},\s*\{ name: "QF", value: 0 \},\s*\{ name: "AY", value: 0 \},\s*\{ name: "IN", value: 0 \},\s*\{ name: "PM", value: 0 \},\s*\{ name: "GM", value: 0 \},\s*\{ name: "BV", value: 0 \},\s*\{ name: "NC", value: 0 \},\s*\{ name: "RC", value: 0 \},\s*\{ name: "EC", value: 0 \},\s*\{ name: "FW", value: 0 \},\s*\{ name: "NF", value: 0 \},\s*\];/;

const replacement = `const stageCounts = await opportunitiesRepository.countByStage(targetUserId);
      const overall = [
          { name: "LD", value: stageCounts["LD"] || 0 },
          { name: "QF", value: stageCounts["QF"] || 0 },
          { name: "AY", value: stageCounts["AY"] || 0 },
          { name: "IN", value: stageCounts["IN"] || 0 },
          { name: "PM", value: stageCounts["PM"] || 0 },
          { name: "GM", value: stageCounts["GM"] || 0 },
          { name: "BV", value: stageCounts["BV"] || 0 },
          { name: "NC", value: stageCounts["NC"] || 0 },
          { name: "RC", value: stageCounts["RC"] || 0 },
          { name: "EC", value: stageCounts["EC"] || 0 },
          { name: "FW", value: stageCounts["FW"] || 0 },
          { name: "NF", value: stageCounts["NF"] || 0 },
      ];`;

if (overallRegex.test(c)) {
  c = c.replace(overallRegex, replacement);
  fs.writeFileSync('c:/webexcel/WebExcelsDRM/server/service-executive-routes.ts', c);
  console.log("Updated service-executive-routes.ts successfully.");
} else {
  console.log("Regex not found in service-executive-routes.ts");
}
