import type { NextConfig } from "next";
import path from "path";
import { legacyAppRedirects } from "./src/lib/navigation/legacy-redirects";

const sharedDir = path.resolve(process.cwd(), "../frontend/shared");

const backendUrl =
  process.env.BACKEND_URL?.replace(/\/$/, "") || "http://localhost:5001";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  /** Allow importing from sibling `frontend/shared/` (outside app root). */
  experimental: {
    externalDir: true,
  },
  turbopack: {
    resolveAlias: {
      "@shared": sharedDir,
      "@shared/validators": path.join(sharedDir, "validators.ts"),
      "@shared/gm-sales-constants": path.join(
        sharedDir,
        "gm-sales-constants.ts",
      ),
      "@shared/service-bridge-constants": path.join(
        sharedDir,
        "service-bridge-constants.ts",
      ),
      "@shared/verification-lifecycle": path.join(
        sharedDir,
        "verification-lifecycle.ts",
      ),
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": sharedDir,
    };
    return config;
  },
  async redirects() {
    return legacyAppRedirects();
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
