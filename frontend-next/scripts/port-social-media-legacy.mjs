import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "../..");
const fe = path.join(root, "frontend");
const next = path.join(root, "frontend-next");

const uiLegacy = [
  "button",
  "dialog",
  "select",
  "alert-dialog",
];

function rewrite(content) {
  let s = content;
  s = s.replace(/@\/hooks\/use-toast/g, "@/lib/hooks/use-legacy-toast");
  s = s.replace(/@\/lib\/queryClient/g, "@/lib/query/query-client");
  for (const comp of uiLegacy) {
    const re = new RegExp(`@/components/ui/${comp}`, "g");
    s = s.replace(re, `@/components/ui/legacy/${comp}`);
  }
  return s;
}

const srcRel = "src/pages/social-media.tsx";
const destRel = "src/modules/social-media/social-media-view.tsx";
const src = path.join(fe, srcRel);
const dest = path.join(next, destRel);
fs.mkdirSync(path.dirname(dest), { recursive: true });
let out = rewrite(fs.readFileSync(src, "utf8"));
out = out.replace(/^export default function SocialMedia/m, "export function SocialMediaPage");
if (!out.includes('"use client"')) {
  out = `"use client";\n\n${out}`;
}
fs.writeFileSync(dest, out);
console.log("ported", destRel);
