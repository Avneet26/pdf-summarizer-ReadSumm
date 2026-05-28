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

const r2Configured = Boolean(
  process.env.R2_ACCOUNT_ID?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim() &&
    process.env.R2_BUCKET_NAME?.trim(),
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_R2_UPLOADS_ENABLED: r2Configured ? "true" : "false",
  },
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "@libsql/client"],
  outputFileTracingIncludes: {
    "/api/documents/upload/prepare": pdfTracing,
    "/api/documents/upload/complete": pdfTracing,
    "/api/documents/upload/direct": pdfTracing,
    "/api/documents/[id]/continue": pdfTracing,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
