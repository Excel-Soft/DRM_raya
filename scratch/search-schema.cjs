const fs = require("fs");
const path = require("path");

const schemaPath = path.resolve(__dirname, "../shared/schema.ts");
const content = fs.readFileSync(schemaPath, "utf-8");
const lines = content.split("\n");

console.log("=== SEARCH RESULTS ===");
lines.forEach((line, index) => {
  if (line.toLowerCase().includes("notification") && !line.includes("notificationTypeEnum") && !line.includes("notificationReadStatusEnum")) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
