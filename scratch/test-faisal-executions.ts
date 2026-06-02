import { getExecutionRowsForRole } from "../server/services/product-posting-workflow.service";

async function main() {
  const result = await getExecutionRowsForRole("posting_executive", "64b855c8-1136-4d7a-bc8c-17f172e65199");
  console.log("getExecutionRowsForRole output for Faisal:", JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
