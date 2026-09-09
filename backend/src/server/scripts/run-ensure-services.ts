import { ensureServicesSchema } from "../repositories/services.repository";

async function run() {
  console.log("Running ensureServicesSchema...");
  await ensureServicesSchema();
  console.log("Done.");
  process.exit(0);
}

run();
