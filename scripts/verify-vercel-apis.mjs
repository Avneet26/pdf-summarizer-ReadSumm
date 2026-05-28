#!/usr/bin/env node
/**
 * Smoke-test production (or any) deployment APIs.
 * Usage: node scripts/verify-vercel-apis.mjs [baseUrl]
 */
const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

if (!base) {
  console.error("Pass base URL: node scripts/verify-vercel-apis.mjs https://your-app.vercel.app");
  process.exit(1);
}

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ name, ok: false, message });
    console.error(`✗ ${name}: ${message}`);
  }
}

await check("GET /", async () => {
  const res = await fetch(`${base}/`);
  if (!res.ok) throw new Error(`status ${res.status}`);
});

await check("GET /api/documents", async () => {
  const res = await fetch(`${base}/api/documents`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("expected array");
});

await check("POST /api/documents/upload/prepare", async () => {
  const res = await fetch(`${base}/api/documents/upload/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "smoke-test.pdf",
      contentType: "application/pdf",
      size: 1024,
    }),
  });
  const text = await res.text();
  if (res.status === 503 && text.includes("BLOB_READ_WRITE_TOKEN")) {
    console.log("  (skipped: Blob not configured on this host)");
    return;
  }
  if (!res.ok) throw new Error(`status ${res.status}: ${text}`);
  const data = JSON.parse(text);
  if (!data.documentId || !data.pathname) throw new Error("missing prepare fields");
});

await check("POST /api/documents/upload/complete (unknown doc → 404 JSON)", async () => {
  const res = await fetch(`${base}/api/documents/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: "smoke-nonexistent-id",
      blobUrl: "https://example.com/fake.pdf",
    }),
  });
  const text = await res.text();
  if (text.startsWith("<!DOCTYPE")) {
    throw new Error("got HTML error page instead of JSON — route may be misconfigured");
  }
  if (res.status === 503 && text.includes("not configured")) {
    console.log("  (skipped: Blob not configured on this host)");
    return;
  }
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}: ${text}`);
});

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
