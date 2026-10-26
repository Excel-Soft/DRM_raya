import { apiFetch } from "@/lib/api/browser-client";

export type ImportResult = {
  successCount: number;
  failCount: number;
  headers: string[];
  errors: string[];
};

function parseCSV(str: string): { headers: string[]; rows: string[][] } {
  str = str.replace(/^\uFEFF/, "");
  const firstLine = str.split(/[\r\n]+/)[0] ?? "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ";" : ",";

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      currentRow.push(current.trim());
      current = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && str[i + 1] === "\n") i++;
      currentRow.push(current.trim());
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      current = "";
      continue;
    }
    current += ch;
  }
  currentRow.push(current.trim());
  if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);

  const headers = rows.shift() ?? [];
  return { headers, rows };
}

export async function importCustomersFromCsvFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const { headers, rows } = parseCSV(text);
  const detectedHeaders: string[] = [];
  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const rowData: Record<string, string | string[]> = {};
    headers.forEach((header, index) => {
      const value = row[index] || "";
      const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!detectedHeaders.includes(header)) detectedHeaders.push(header);

      if (h === "companyname" || h === "company" || h === "client" || h === "business") rowData.company = value;
      else if (h === "accountholdername" || h === "accountholder" || h === "account" || h === "name")
        rowData.accountHolder = value;
      else if (h === "email" || h === "mail" || h === "emailaddress") rowData.email = value;
      else if (h === "contactno" || h === "contact" || h === "phone") rowData.phone = value;
      else if (h === "grade" || h === "clientgrade") rowData.grade = value;
      else if (h === "region" || h === "location") rowData.region = value;
      else if (h === "cnic") rowData.cnic = value;
      else if (h === "ntn") rowData.ntn = value;
      else if (h === "mobile") rowData.mobile = value;
      else if (h === "companytype" || h === "type") rowData.companyType = value;
      else if (h === "personname") rowData.personName = value;
      else if (h === "source") rowData.source = value;
      else if (h === "status" || h === "stage") rowData.stage = value;
      else if (h === "country") rowData.country = value;
      else if (h === "city") rowData.city = value;
      else if (h === "address") rowData.address = value;
      else if (h === "abtype" || h === "ab") rowData.abType = value;
    });

    if (!rowData.stage) rowData.stage = "New";
    if (!rowData.serviceTypes) rowData.serviceTypes = [];

    const missing: string[] = [];
    if (!rowData.company) missing.push("Company");
    if (!rowData.email) missing.push("Email");
    if (!rowData.phone) missing.push("Phone");
    if (!rowData.accountHolder) missing.push("Account Holder");
    if (!rowData.grade) missing.push("Grade");
    if (!rowData.region) missing.push("Region");

    const rowNum = rows.indexOf(row) + 2;
    if (missing.length > 0) {
      failCount++;
      errors.push(`Row ${rowNum}: Missing ${missing.join(", ")}`);
      continue;
    }

    try {
      const result = await apiFetch<{ success?: boolean; message?: string }>("/api/sales/customers", {
        method: "POST",
        json: { ...rowData, upsert: true },
      });
      if (result.success !== false) successCount++;
      else {
        failCount++;
        errors.push(`Row ${rowNum}: ${result.message || "Unknown error"}`);
      }
    } catch (e) {
      failCount++;
      errors.push(`Row ${rowNum}: ${e instanceof Error ? e.message : "Network error"}`);
    }
  }

  return { successCount, failCount, headers: detectedHeaders, errors };
}

export function downloadCustomerImportTemplate() {
  const headers = [
    "Company Name",
    "Country",
    "City",
    "Address",
    "Contact No",
    "Account Holder Name",
    "Email",
    "Grade",
    "Region",
    "CNIC",
    "NTN",
    "Mobile",
    "Company Type",
    "Person Name",
    "Source",
    "Status",
    "AB Type",
  ];
  const csvContent =
    `${headers.join(",")}\n` +
    "Example Company,Pakistan,Lahore,123 Main St,12345678901,John Doe,john@example.com,C,Pakistan,1234512345671,1234567123451,12345123456,Private Limited,Jane Doe,Website,New,GS";
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "customer_import_template.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}
