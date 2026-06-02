// vite.config.ts
import { defineConfig } from "file:///C:/Users/Talha/Desktop/WebExcelsDRM-main/WebExcelsDRM-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Talha/Desktop/WebExcelsDRM-main/WebExcelsDRM-main/node_modules/@vitejs/plugin-react/dist/index.js";
import autoprefixer from "file:///C:/Users/Talha/Desktop/WebExcelsDRM-main/WebExcelsDRM-main/node_modules/autoprefixer/lib/autoprefixer.js";
import { Input } from "file:///C:/Users/Talha/Desktop/WebExcelsDRM-main/WebExcelsDRM-main/node_modules/postcss/lib/postcss.mjs";
import path from "path";
import tailwindcss from "file:///C:/Users/Talha/Desktop/WebExcelsDRM-main/WebExcelsDRM-main/node_modules/tailwindcss/lib/index.js";
var __vite_injected_original_dirname = "C:\\Users\\Talha\\Desktop\\WebExcelsDRM-main\\WebExcelsDRM-main";
var defaultFrom = path.resolve(
  __vite_injected_original_dirname,
  "client",
  "src",
  "index.css"
);
var ensureFrom = () => ({
  postcssPlugin: "ensure-from",
  Once(root, { result }) {
    const fallback = result?.opts?.from || root.source?.input?.file || defaultFrom || "inline.css";
    const input = root.source?.input ?? new Input("", { from: fallback });
    if (root.source?.input && !root.source.input.file) {
      root.source.input.file = fallback;
    }
    root.walk((node) => {
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
  }
});
ensureFrom.postcss = true;
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "client", "src"),
      "@shared": path.resolve(__vite_injected_original_dirname, "shared"),
      "@assets": path.resolve(__vite_injected_original_dirname, "attached_assets")
    }
  },
  root: path.resolve(__vite_injected_original_dirname, "client"),
  build: {
    outDir: path.resolve(__vite_injected_original_dirname, "dist/public"),
    emptyOutDir: true
  },
  css: {
    postcss: {
      // Provide an explicit source path to satisfy PostCSS parse expectations
      from: defaultFrom,
      plugins: [tailwindcss(), autoprefixer(), ensureFrom()]
    }
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxUYWxoYVxcXFxEZXNrdG9wXFxcXFdlYkV4Y2Vsc0RSTS1tYWluXFxcXFdlYkV4Y2Vsc0RSTS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxUYWxoYVxcXFxEZXNrdG9wXFxcXFdlYkV4Y2Vsc0RSTS1tYWluXFxcXFdlYkV4Y2Vsc0RSTS1tYWluXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9UYWxoYS9EZXNrdG9wL1dlYkV4Y2Vsc0RSTS1tYWluL1dlYkV4Y2Vsc0RSTS1tYWluL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xyXG5pbXBvcnQgYXV0b3ByZWZpeGVyIGZyb20gXCJhdXRvcHJlZml4ZXJcIjtcclxuaW1wb3J0IHsgSW5wdXQgfSBmcm9tIFwicG9zdGNzc1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcInRhaWx3aW5kY3NzXCI7XHJcblxyXG5jb25zdCBkZWZhdWx0RnJvbSA9IHBhdGgucmVzb2x2ZShcclxuICBpbXBvcnQubWV0YS5kaXJuYW1lLFxyXG4gIFwiY2xpZW50XCIsXHJcbiAgXCJzcmNcIixcclxuICBcImluZGV4LmNzc1wiLFxyXG4pO1xyXG5cclxuY29uc3QgZW5zdXJlRnJvbSA9ICgpID0+ICh7XHJcbiAgcG9zdGNzc1BsdWdpbjogXCJlbnN1cmUtZnJvbVwiLFxyXG4gIE9uY2Uocm9vdDogYW55LCB7IHJlc3VsdCB9OiBhbnkpIHtcclxuICAgIGNvbnN0IGZhbGxiYWNrID1cclxuICAgICAgKHJlc3VsdD8ub3B0cz8uZnJvbSBhcyBzdHJpbmcpIHx8XHJcbiAgICAgIHJvb3Quc291cmNlPy5pbnB1dD8uZmlsZSB8fFxyXG4gICAgICBkZWZhdWx0RnJvbSB8fFxyXG4gICAgICBcImlubGluZS5jc3NcIjtcclxuICAgIGNvbnN0IGlucHV0ID0gcm9vdC5zb3VyY2U/LmlucHV0ID8/IG5ldyBJbnB1dChcIlwiLCB7IGZyb206IGZhbGxiYWNrIH0pO1xyXG5cclxuICAgIGlmIChyb290LnNvdXJjZT8uaW5wdXQgJiYgIXJvb3Quc291cmNlLmlucHV0LmZpbGUpIHtcclxuICAgICAgcm9vdC5zb3VyY2UuaW5wdXQuZmlsZSA9IGZhbGxiYWNrO1xyXG4gICAgfVxyXG5cclxuICAgIHJvb3Qud2Fsaygobm9kZTogYW55KSA9PiB7XHJcbiAgICAgIGlmICghbm9kZS5zb3VyY2UpIHtcclxuICAgICAgICBub2RlLnNvdXJjZSA9IHsgaW5wdXQgfTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCFub2RlLnNvdXJjZS5pbnB1dCkge1xyXG4gICAgICAgIG5vZGUuc291cmNlLmlucHV0ID0gaW5wdXQ7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCFub2RlLnNvdXJjZS5pbnB1dC5maWxlKSB7XHJcbiAgICAgICAgbm9kZS5zb3VyY2UuaW5wdXQuZmlsZSA9IGZhbGxiYWNrO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9LFxyXG59KTtcclxuZW5zdXJlRnJvbS5wb3N0Y3NzID0gdHJ1ZTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJjbGllbnRcIiwgXCJzcmNcIiksXHJcbiAgICAgIFwiQHNoYXJlZFwiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJzaGFyZWRcIiksXHJcbiAgICAgIFwiQGFzc2V0c1wiOiBwYXRoLnJlc29sdmUoaW1wb3J0Lm1ldGEuZGlybmFtZSwgXCJhdHRhY2hlZF9hc3NldHNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgcm9vdDogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiY2xpZW50XCIpLFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6IHBhdGgucmVzb2x2ZShpbXBvcnQubWV0YS5kaXJuYW1lLCBcImRpc3QvcHVibGljXCIpLFxyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgfSxcclxuICBjc3M6IHtcclxuICAgIHBvc3Rjc3M6IHtcclxuICAgICAgLy8gUHJvdmlkZSBhbiBleHBsaWNpdCBzb3VyY2UgcGF0aCB0byBzYXRpc2Z5IFBvc3RDU1MgcGFyc2UgZXhwZWN0YXRpb25zXHJcbiAgICAgIGZyb206IGRlZmF1bHRGcm9tLFxyXG4gICAgICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MoKSwgYXV0b3ByZWZpeGVyKCksIGVuc3VyZUZyb20oKV0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBmczoge1xyXG4gICAgICBzdHJpY3Q6IHRydWUsXHJcbiAgICAgIGRlbnk6IFtcIioqLy4qXCJdLFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0VyxTQUFTLG9CQUFvQjtBQUN6WSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxrQkFBa0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLE9BQU8sVUFBVTtBQUNqQixPQUFPLGlCQUFpQjtBQUx4QixJQUFNLG1DQUFtQztBQU96QyxJQUFNLGNBQWMsS0FBSztBQUFBLEVBQ3ZCO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Y7QUFFQSxJQUFNLGFBQWEsT0FBTztBQUFBLEVBQ3hCLGVBQWU7QUFBQSxFQUNmLEtBQUssTUFBVyxFQUFFLE9BQU8sR0FBUTtBQUMvQixVQUFNLFdBQ0gsUUFBUSxNQUFNLFFBQ2YsS0FBSyxRQUFRLE9BQU8sUUFDcEIsZUFDQTtBQUNGLFVBQU0sUUFBUSxLQUFLLFFBQVEsU0FBUyxJQUFJLE1BQU0sSUFBSSxFQUFFLE1BQU0sU0FBUyxDQUFDO0FBRXBFLFFBQUksS0FBSyxRQUFRLFNBQVMsQ0FBQyxLQUFLLE9BQU8sTUFBTSxNQUFNO0FBQ2pELFdBQUssT0FBTyxNQUFNLE9BQU87QUFBQSxJQUMzQjtBQUVBLFNBQUssS0FBSyxDQUFDLFNBQWM7QUFDdkIsVUFBSSxDQUFDLEtBQUssUUFBUTtBQUNoQixhQUFLLFNBQVMsRUFBRSxNQUFNO0FBQ3RCO0FBQUEsTUFDRjtBQUNBLFVBQUksQ0FBQyxLQUFLLE9BQU8sT0FBTztBQUN0QixhQUFLLE9BQU8sUUFBUTtBQUFBLE1BQ3RCO0FBQ0EsVUFBSSxDQUFDLEtBQUssT0FBTyxNQUFNLE1BQU07QUFDM0IsYUFBSyxPQUFPLE1BQU0sT0FBTztBQUFBLE1BQzNCO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBQ0EsV0FBVyxVQUFVO0FBRXJCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBcUIsVUFBVSxLQUFLO0FBQUEsTUFDdEQsV0FBVyxLQUFLLFFBQVEsa0NBQXFCLFFBQVE7QUFBQSxNQUNyRCxXQUFXLEtBQUssUUFBUSxrQ0FBcUIsaUJBQWlCO0FBQUEsSUFDaEU7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNLEtBQUssUUFBUSxrQ0FBcUIsUUFBUTtBQUFBLEVBQ2hELE9BQU87QUFBQSxJQUNMLFFBQVEsS0FBSyxRQUFRLGtDQUFxQixhQUFhO0FBQUEsSUFDdkQsYUFBYTtBQUFBLEVBQ2Y7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILFNBQVM7QUFBQTtBQUFBLE1BRVAsTUFBTTtBQUFBLE1BQ04sU0FBUyxDQUFDLFlBQVksR0FBRyxhQUFhLEdBQUcsV0FBVyxDQUFDO0FBQUEsSUFDdkQ7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixJQUFJO0FBQUEsTUFDRixRQUFRO0FBQUEsTUFDUixNQUFNLENBQUMsT0FBTztBQUFBLElBQ2hCO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
