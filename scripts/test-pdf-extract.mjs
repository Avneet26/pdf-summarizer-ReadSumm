#!/usr/bin/env node
/**
 * Verifies pdf-parse works in Node (DOMMatrix polyfill).
 * Usage: node scripts/test-pdf-extract.mjs [path-to.pdf]
 */
import { readFileSync } from "node:fs";

await import("pdf-parse/worker");
const { PDFParse } = await import("pdf-parse");

const path = process.argv[2];
const buffer = path
  ? readFileSync(path)
  : Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n5 0 obj<</Length 44>>stream\nBT /F1 24 Tf 100 100 Td (Hello PDF) Tj ET\nendstream\nendobj\nxref\n0 6\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n0\n%%EOF",
    );

if (typeof globalThis.DOMMatrix === "undefined") {
  console.error("FAIL: DOMMatrix still undefined after pdf-parse/worker");
  process.exit(1);
}

const parser = new PDFParse({ data: buffer });
try {
  const result = await parser.getText();
  const text = result.pages.map((p) => p.text).join(" ").trim();
  console.log(`OK: extracted ${text.length} chars, pages=${result.total ?? result.pages.length}`);
  if (text.length > 0) console.log(`Sample: ${text.slice(0, 80)}`);
} finally {
  await parser.destroy();
}
