import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** Native canvas binaries Vercel needs for pdf-parse / pdfjs-dist on Linux. */
const canvasNativeTracing = [
  "./node_modules/@napi-rs/canvas/**/*",
  "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
  "./node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
  "./node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*",
  "./node_modules/@napi-rs/canvas-linux-arm64-musl/**/*",
];

const pdfTracing = [
  "./node_modules/pdf-parse/**/*",
  "./node_modules/pdfjs-dist/**/*",
  ...canvasNativeTracing,
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "@libsql/client"],
  outputFileTracingIncludes: {
    "/api/documents/upload/complete": pdfTracing,
    "/api/documents/upload/direct": pdfTracing,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
