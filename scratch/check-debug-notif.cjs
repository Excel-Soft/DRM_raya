const fs = require("fs");
const path = require("path");

const logPath = path.resolve(__dirname, "../notification_debug_log.txt");
if (fs.existsSync(logPath)) {
  console.log("=== DEBUG NOTIFICATION LOG ===");
  console.log(fs.readFileSync(logPath, "utf-8"));
} else {
  console.log("Log file does not exist:", logPath);
}
