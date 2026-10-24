/**
 * Tailwind v4 PostCSS — enabled only for `next build --webpack` (see TAILWIND_POSTCSS=1).
 * Turbopack dev uses @tailwindcss/turbopack in next.config.ts instead (native PostCSS breaks in Turbopack).
 */
export default {
  plugins:
    process.env.TAILWIND_POSTCSS === "1"
      ? { "@tailwindcss/postcss": {} }
      : {},
};
