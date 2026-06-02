import { getExecutionRowsForRole } from "../server/services/product-posting-workflow.service";

async function main() {
  const userId = "64b855c8-1136-4d7a-bc8c-17f172e65199";
  const roleId = "posting_executive";
  const data = await getExecutionRowsForRole(roleId, userId);
  console.log("Execution Rows for Faisal:", JSON.stringify(data, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
