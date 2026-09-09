import { parse } from "csv-parse/sync";

export type CsvRecord = Record<string, string>;

export function parseCsvBuffer(buffer: Buffer): CsvRecord[] {
  const text = buffer.toString("utf8");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as CsvRecord[];

  return records.map((record) => {
    const normalized: CsvRecord = {};
    for (const [key, value] of Object.entries(record)) {
      normalized[key.trim()] = typeof value === "string" ? value.trim() : String(value ?? "");
    }
    return normalized;
  });
}

export function buildCsvTemplate(headers: string[], sampleRow: Record<string, string>): string {
  const headerLine = headers.join(",");
  const rowLine = headers
    .map((header) => {
      const raw = sampleRow[header] ?? "";
      const escaped = String(raw).replaceAll('"', '""');
      return `"${escaped}"`;
    })
    .join(",");

  return `${headerLine}\n${rowLine}\n`;
}

