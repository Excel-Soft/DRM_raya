import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");
const fe = path.join(root, "frontend");
const next = path.join(root, "frontend-next");

const uiLegacy = [
  "button", "card", "badge", "dialog", "table", "tabs", "switch", "checkbox", "dropdown-menu", "select",
];

function rewrite(content) {
  let s = content;
  s = s.replace(/@\/hooks\/use-toast/g, "@/lib/hooks/use-legacy-toast");
  s = s.replace(/@\/lib\/queryClient/g, "@/lib/query/query-client");
  for (const comp of uiLegacy) {
    const re = new RegExp(`@/components/ui/${comp}`, "g");
    s = s.replace(re, `@/components/ui/legacy/${comp}`);
  }
  s = s.replace(/@\/components\/service-catalog-tree/g, "@/modules/drm/components/service-catalog-tree");
  s = s.replace(/@\/components\/qa-attribute-tree/g, "@/modules/drm/components/qa-attribute-tree");
  s = s.replace(/@\/components\/buyer-detail-tree/g, "@/modules/drm/components/buyer-detail-tree");
  s = s.replace(/@\/components\/departments-manager/g, "@/modules/drm/components/departments-manager");
  s = s.replace(/from "wouter"/g, 'from "next/link" /* wouter shim — fix manually if needed */');
  return s;
}

const copies = [
  ["src/pages/drm/attributes.tsx", "src/modules/drm/attributes-view.tsx"],
  ["src/pages/drm/permission.tsx", "src/modules/drm/permission-view.tsx"],
  ["src/pages/drm/promotion.tsx", "src/modules/drm/promotion-view.tsx"],
  ["src/pages/drm/delay-project.tsx", "src/modules/drm/delay-project-view.tsx"],
  ["src/pages/drm/related-customer.tsx", "src/modules/drm/related-customer-view.tsx"],
  ["src/pages/drm/pms-setting.tsx", "src/modules/drm/pms-setting-view.tsx"],
  ["src/pages/bot-system.tsx", "src/modules/drm/bot-system-view.tsx"],
  ["src/pages/online-form.tsx", "src/modules/drm/online-form-view.tsx"],
  ["src/pages/fb-post.tsx", "src/modules/drm/fb-post-view.tsx"],
  ["src/pages/bot-system-inactive.tsx", "src/modules/drm/bot-system-inactive-view.tsx"],
  ["src/pages/online-form-inactive.tsx", "src/modules/drm/online-form-inactive-view.tsx"],
  ["src/pages/fb-post-inactive.tsx", "src/modules/drm/fb-post-inactive-view.tsx"],
  ["src/pages/super-admin-dashboard.tsx", "src/modules/drm/super-admin-view.tsx"],
  ["src/pages/admin-dashboard.tsx", "src/modules/drm/admin-dashboard-view.tsx"],
  ["src/components/service-catalog-tree.tsx", "src/modules/drm/components/service-catalog-tree.tsx"],
  ["src/components/qa-attribute-tree.tsx", "src/modules/drm/components/qa-attribute-tree.tsx"],
  ["src/components/buyer-detail-tree.tsx", "src/modules/drm/components/buyer-detail-tree.tsx"],
  ["src/components/departments-manager.tsx", "src/modules/drm/components/departments-manager.tsx"],
];

for (const [srcRel, destRel] of copies) {
  const src = path.join(fe, srcRel);
  const dest = path.join(next, destRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const raw = fs.readFileSync(src, "utf8");
  let out = rewrite(raw);
  out = out.replace(/^export default function (\w+)/m, "export function $1");
  if (!out.includes('"use client"')) {
    out = `"use client";\n\n${out}`;
  }
  fs.writeFileSync(dest, out);
  console.log("ported", destRel);
}
