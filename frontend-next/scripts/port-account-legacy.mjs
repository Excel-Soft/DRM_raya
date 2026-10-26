import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");
const fe = path.join(root, "frontend");
const next = path.join(root, "frontend-next");

const uiLegacy = [
  "button",
  "card",
  "badge",
  "dialog",
  "table",
  "tabs",
  "switch",
  "checkbox",
  "dropdown-menu",
  "select",
  "scroll-area",
  "form",
];

const accountRoutesImport = `import {
  ACCOUNT_DOLLAR_ADVANCE_PAYMENT,
  ACCOUNT_DOLLAR_BUYING,
  ACCOUNT_LEDGER,
  accountHistoryPath,
} from "@/lib/navigation/account-routes";
`;

function rewrite(content, opts = {}) {
  let s = content;
  s = s.replace(/@\/hooks\/use-toast/g, "@/lib/hooks/use-legacy-toast");
  s = s.replace(/@\/lib\/queryClient/g, "@/lib/query/query-client");
  for (const comp of uiLegacy) {
    const re = new RegExp(`@/components/ui/${comp}`, "g");
    s = s.replace(re, `@/components/ui/legacy/${comp}`);
  }
  s = s.replace(
    /@\/components\/gm\//g,
    "@/modules/account/components/gm/",
  );
  s = s.replace(
    /@\/components\/gm-detail-invoices-modal/g,
    "@/modules/account/components/gm-detail-invoices-modal",
  );
  s = s.replace(
    /@\/components\/gm-entry-invoice-form/g,
    "@/modules/account/components/gm-entry-invoice-form",
  );
  s = s.replace(
    /@\/components\/account-approval-modal/g,
    "@/modules/account/components/account-approval-modal",
  );

  if (opts.wouterRouter) {
    s = s.replace(/import \{ Link, useLocation \} from "wouter";/g, 'import Link from "next/link";\nimport { useRouter } from "next/navigation";');
    s = s.replace(/import \{ useParams, useLocation \} from "wouter";/g, 'import { useParams, useRouter } from "next/navigation";');
    s = s.replace(/import \{ useLocation \} from "wouter";/g, 'import { useRouter } from "next/navigation";');
    s = s.replace(/const \[, setLocation\] = useLocation\(\);/g, "const router = useRouter();");
    s = s.replace(/setLocation\(/g, "router.push(");
    s = s.replace(/router\.push\("\/account\/ledger"\)/g, "router.push(ACCOUNT_LEDGER)");
    s = s.replace(/router\.push\('\/account\/ledger'\)/g, "router.push(ACCOUNT_LEDGER)");
    s = s.replace(/router\.push\("\/account\/dollar-buying"\)/g, "router.push(ACCOUNT_DOLLAR_BUYING)");
    s = s.replace(/router\.push\("\/account\/dollar-advance-payment"\)/g, "router.push(ACCOUNT_DOLLAR_ADVANCE_PAYMENT)");
    s = s.replace(
      /router\.push\(`\/account\/history\/\$\{encodeURIComponent\(([^)]+)\)\}`\)/g,
      "router.push(accountHistoryPath($1))",
    );
  }

  if (opts.dollarSystem) {
    s = s.replace(
      /import \{ useSidebar \} from "@\/components\/ui\/sidebar";\nimport \{ useLocation \} from "wouter";\n\n/,
      "",
    );
    s = s.replace(
      /const \{ open: sidebarOpen, setOpen: setSidebarOpen \} = useSidebar\(\);\n  useEffect\(\(\) => \{ const w = sidebarOpen; setSidebarOpen\(false\); return \(\) => setSidebarOpen\(w\); \}, \[\]\);\n\n/,
      "",
    );
    s = s.replace(/href="\/account\/dollar-buying"/g, `href="${"/dashboard/account/dollar-buying"}"`);
    s = s.replace(/href="\/account\/dollar-advance-payment"/g, `href="${"/dashboard/account/dollar-advance-payment"}"`);
    s = s.replace(/onClick=\{a\?\(\)=>setLocation\(a\):undefined\}/g, "onClick={a?()=>router.push(a):undefined}");
    s = s.replace(
      /\[\["Receive", "\/account\/dollar-buying"\],\["Send","\/account\/dollar-pay"\],\["Balance",null\],\["Advance Pay","\/account\/dollar-advance-payment"\]\]/g,
      `[["Receive", ACCOUNT_DOLLAR_BUYING],["Send","/account/dollar-pay"],["Balance",null],["Advance Pay",ACCOUNT_DOLLAR_ADVANCE_PAYMENT]]`,
    );
  }

  return s;
}

function portFile(srcRel, destRel, opts = {}) {
  const src = path.join(fe, srcRel);
  const dest = path.join(next, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let out = rewrite(fs.readFileSync(src, "utf8"), opts);
  out = out.replace(/^export default function (\w+)/m, "export function $1Page");
  if (!out.includes('"use client"')) {
    out = `"use client";\n\n${out}`;
  }
  const needsRoutes =
    opts.wouterRouter ||
    opts.dollarSystem ||
    out.includes("ACCOUNT_LEDGER") ||
    out.includes("accountHistoryPath") ||
    out.includes("ACCOUNT_DOLLAR_BUYING");
  if (needsRoutes && !out.includes("@/lib/navigation/account-routes")) {
    out = out.replace('"use client";\n\n', `"use client";\n\n${accountRoutesImport}\n`);
  }
  if (opts.dollarSystem && !out.includes('import { useRouter }')) {
    out = out.replace('"use client";\n\n', '"use client";\n\nimport { useRouter } from "next/navigation";\n\n');
    out = out.replace(
      /export function DollarSystemPage\(\) \{\n/,
      "export function DollarSystemPage() {\n  const router = useRouter();\n",
    );
  }
  fs.writeFileSync(dest, out);
  console.log("ported", destRel);
}

const copies = [
  ["src/pages/account-gm-entries.tsx", "src/modules/account/account-gm-entries-view.tsx", {}],
  ["src/pages/account-temp-gm.tsx", "src/modules/account/account-temp-gm-view.tsx", {}],
  ["src/pages/account-refund-gm.tsx", "src/modules/account/account-refund-gm-view.tsx", {}],
  ["src/pages/account-donations.tsx", "src/modules/account/account-donations-view.tsx", {}],
  ["src/pages/account-invoices.tsx", "src/modules/account/account-invoices-view.tsx", {}],
  ["src/pages/account-ledger.tsx", "src/modules/account/account-ledger-view.tsx", { wouterRouter: true }],
  ["src/pages/account-history.tsx", "src/modules/account/account-history-view.tsx", { wouterRouter: true }],
  ["src/pages/ab-report.tsx", "src/modules/account/ab-report-view.tsx", {}],
  ["src/pages/dollar-system.tsx", "src/modules/account/dollar-system-view.tsx", { dollarSystem: true }],
  ["src/pages/dollar-buying.tsx", "src/modules/account/dollar-buying-view.tsx", {}],
  ["src/pages/dollar-advance-payment.tsx", "src/modules/account/dollar-advance-payment-view.tsx", {}],
  ["src/components/gm/PartialReceiptsDialog.tsx", "src/modules/account/components/gm/PartialReceiptsDialog.tsx", {}],
  ["src/components/gm/LoanTermsDialog.tsx", "src/modules/account/components/gm/LoanTermsDialog.tsx", {}],
  ["src/components/gm-detail-invoices-modal.tsx", "src/modules/account/components/gm-detail-invoices-modal.tsx", {}],
  ["src/components/gm-entry-invoice-form.tsx", "src/modules/account/components/gm-entry-invoice-form.tsx", {}],
  ["src/components/account-approval-modal.tsx", "src/modules/account/components/account-approval-modal.tsx", {}],
];

for (const [srcRel, destRel, opts] of copies) {
  portFile(srcRel, destRel, opts);
}

const commandSrc = path.join(fe, "src/components/ui/command.tsx");
const commandDest = path.join(next, "src/components/ui/command.tsx");
if (!fs.existsSync(commandDest) && fs.existsSync(commandSrc)) {
  fs.mkdirSync(path.dirname(commandDest), { recursive: true });
  fs.writeFileSync(commandDest, fs.readFileSync(commandSrc, "utf8"));
  console.log("copied command.tsx");
}
