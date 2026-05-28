import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  // pdf-parse must be bundled — externalized Turbopack aliases break in after() on Vercel.
  serverExternalPackages: ["@libsql/client"],
  outputFileTracingIncludes: {
    "/api/documents/upload/complete": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
    ],
    "/api/documents/upload/direct": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
