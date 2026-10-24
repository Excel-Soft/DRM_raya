#!/usr/bin/env node
/**
 * Copy static assets into the Next standalone output (required for CSS/JS/fonts).
 * Run after `npm run build` from frontend-next/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneDir = path.join(root, ".next", "standalone");
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standaloneDir, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDest = path.join(standaloneDir, "public");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Missing source: ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error("Run `npm run build` first (.next/standalone/server.js missing).");
  process.exit(1);
}

copyRecursive(staticSrc, staticDest);
if (fs.existsSync(publicSrc)) copyRecursive(publicSrc, publicDest);

console.log("Standalone assets prepared:");
console.log("  .next/static → .next/standalone/.next/static");
console.log("  public → .next/standalone/public");
console.log("");
console.log("If standalone is already running on PORT, restart it (chunks/CSS 404 until restart).");
console.log("  PORT=3001 BACKEND_URL=http://127.0.0.1:5001 npm run start:standalone");
