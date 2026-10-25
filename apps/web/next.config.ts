import { loadEnvConfig } from "@next/env";
import path from "node:path";
import type { NextConfig } from "next";

// One .env at the monorepo root, shared by the web app, worker, and db scripts.
// forceReload: Next has already loaded (empty) env from apps/web and caches that result.
loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@ajh/core", "@ajh/db", "@ajh/infra", "@ajh/ai", "@ajh/app"],
  // Native/Node-only libraries stay external to the server bundle.
  serverExternalPackages: ["mammoth", "unpdf"],
  experimental: {
    // Resumes up to 5 MB, plus multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
