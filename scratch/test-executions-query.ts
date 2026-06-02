import { getExecutionRowsForRole } from "../server/services/product-posting-workflow.service";

async function main() {
  const data = await getExecutionRowsForRole("posting_executive", "64b855c8-1136-4d7a-bc8c-17f172e65199");
  console.log("Execution rows:", data);
}

main().catch(console.error);
