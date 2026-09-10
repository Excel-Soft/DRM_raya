import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import autoprefixer from "autoprefixer";
import { Input } from "postcss";
import path from "path";
import tailwindcss from "tailwindcss";

const defaultFrom = path.resolve(
  import.meta.dirname,
  
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
      "@": path.resolve(import.meta.dirname,  "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname),
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
    // Bind all interfaces (IPv4 + IPv6). Vite's default loopback-only bind
    // resolved to IPv6 (::1) only on this stack, so the dev server was
    // reachable via curl (which preferred IPv6) but refused connections
    // from browsers that resolved "localhost"/127.0.0.1 to IPv4.
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
