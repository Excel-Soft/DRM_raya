import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { Input } from "postcss";
import path from "path";
import tailwindcss from "tailwindcss";

const defaultFrom = path.resolve(
  import.meta.dirname,
  "client",
  "src",
  "index.css",
);

const ensureFrom = () => ({
  postcssPlugin: "ensure-from",
  Once(root: any, { result }: any) {
    const fallback =
      (result?.opts?.from as string) ||
      root.source?.input?.file ||
      defaultFrom ||
      "inline.css";
    const input = root.source?.input ?? new Input("", { from: fallback });

    if (root.source?.input && !root.source.input.file) {
      root.source.input.file = fallback;
    }

    root.walk((node: any) => {
      if (!node.source) {
        node.source = { input };
        return;
      }
      if (!node.source.input) {
        node.source.input = input;
      }
      if (!node.source.input.file) {
        node.source.input.file = fallback;
      }
    });
  },
});
ensureFrom.postcss = true;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  css: {
    postcss: {
      // Provide an explicit source path to satisfy PostCSS parse expectations
      from: defaultFrom,
      plugins: [tailwindcss(), autoprefixer(), ensureFrom()],
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
