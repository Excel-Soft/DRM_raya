import autoprefixer from "autoprefixer";
import { Input } from "postcss";
import path from "node:path";
import tailwindcss from "tailwindcss";

const defaultFrom = path.resolve(
  import.meta.dirname,
  "client",
  "src",
  "index.css",
);

const ensureFrom = () => ({
  postcssPlugin: "ensure-from",
  Once(root, { result }) {
    const fallback =
      result?.opts?.from ||
      root.source?.input?.file ||
      defaultFrom ||
      "inline.css";
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
  },
});
ensureFrom.postcss = true;

export default {
  from: defaultFrom,
  plugins: [tailwindcss(), autoprefixer(), ensureFrom()],
};
