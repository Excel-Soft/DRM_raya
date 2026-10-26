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

function rewrite(content) {
  let s = content;
  s = s.replace(/@\/hooks\/use-toast/g, "@/lib/hooks/use-legacy-toast");
  s = s.replace(/@\/lib\/queryClient/g, "@/lib/query/query-client");
  for (const comp of uiLegacy) {
    const re = new RegExp(`@/components/ui/${comp}`, "g");
    s = s.replace(re, `@/components/ui/legacy/${comp}`);
  }
  s = s.replace(/from "wouter"/g, 'from "next/navigation"');
  s = s.replace(/useLocation\(\)/g, "useRouter()");
  s = s.replace(/const \[, setLocation\] = useRouter\(\)/g, "const router = useRouter()");
  s = s.replace(/setLocation\(/g, "router.push(");
  s = s.replace(/setLocation\(/g, "router.push(");
  s = s.replace(/router\.push\("\/drm\/users\/list"\)/g, 'router.push(USERS_LIST)');
  s = s.replace(/router\.push\('\/drm\/users\/list'\)/g, "router.push(USERS_LIST)");
  return s;
}

const copies = [
  ["src/pages/add-user.tsx", "src/modules/users/add-user-view.tsx"],
  ["src/pages/user-list.tsx", "src/modules/users/user-list-view.tsx"],
  ["src/pages/user-groups.tsx", "src/modules/users/user-groups-view.tsx"],
];

for (const [srcRel, destRel] of copies) {
  const src = path.join(fe, srcRel);
  const dest = path.join(next, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let out = rewrite(fs.readFileSync(src, "utf8"));
  out = out.replace(/^export default function (\w+)/m, "export function $1Page");
  if (!out.includes('"use client"')) {
    out = `"use client";\n\n${out}`;
  }
  if (!out.includes("USERS_LIST")) {
    out = out.replace(
      '"use client";\n\n',
      '"use client";\n\nimport { USERS_LIST } from "@/lib/navigation/users-routes";\n\n',
    );
  }
  fs.writeFileSync(dest, out);
  console.log("ported", destRel);
}
