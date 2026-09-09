import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function getDefaultEnvPaths(): string[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(moduleDir, "..");

  return [
    path.resolve(process.cwd(), ".env"),
    path.resolve(projectRoot, ".env"),
  ];
}

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readEnvFileText(envPath: string): string {
  const buffer = fs.readFileSync(envPath);

  // Support common Windows editor defaults (UTF-16LE with BOM) in addition to UTF-8.
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString("utf16le");
  }

  return buffer.toString("utf8");
}

export function loadEnvFromFile(envPaths: string[] = getDefaultEnvPaths()): void {
  const envPath = envPaths.find((candidate) => fs.existsSync(candidate));
  if (!envPath) return;

  const contents = readEnvFileText(envPath);
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7) : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    const rawValue = normalized.slice(equalsIndex + 1);

    if (!key) continue;
    const existingValue = process.env[key];
    if (existingValue !== undefined && existingValue !== "") continue;

    process.env[key] = parseEnvValue(rawValue);
  }
}

loadEnvFromFile();
