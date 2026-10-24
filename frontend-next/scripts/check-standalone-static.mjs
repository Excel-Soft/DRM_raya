#!/usr/bin/env node
/**
 * Fail fast when standalone server would 404 on /_next/static/* (missing prepare step).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = path.join(root, ".next", "standalone", ".next", "static");
const serverJs = path.join(root, ".next", "standalone", "server.js");

if (!fs.existsSync(serverJs)) {
  console.error("Standalone server missing. Run: npm run build");
  process.exit(1);
}

if (!fs.existsSync(staticDir)) {
  console.error(
    [
      "Standalone static assets missing (.next/standalone/.next/static).",
      "This causes 404 on layout/chunk JS and broken CSS.",
      "Fix: npm run build   # postbuild copies static automatically",
      "     # or: node scripts/prepare-standalone.mjs",
      "Then restart: PORT=3001 node .next/standalone/server.js",
    ].join("\n"),
  );
  process.exit(1);
}

const chunks = path.join(staticDir, "chunks");
if (!fs.existsSync(chunks)) {
  console.error("Standalone static/chunks missing — re-run npm run build.");
  process.exit(1);
}
