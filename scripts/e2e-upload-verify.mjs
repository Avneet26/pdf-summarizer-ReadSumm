#!/usr/bin/env node
/**
 * Playwright E2E: upload sample PDF, wait for processing, capture screenshots.
 *
 * Usage:
 *   node scripts/e2e-upload-verify.mjs
 *   E2E_BASE_URL=https://pdf-summarizer-read-summ.vercel.app node scripts/e2e-upload-verify.mjs
 *
 * Screenshots + result JSON are written to the project root.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const samplePdf = path.join(projectRoot, "fixtures", "sample-e2e.pdf");
const baseUrl = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const maxWaitMs = Number(process.env.E2E_MAX_WAIT_MS ?? 180_000);
const pollMs = 3_000;

const screenshots = [];

async function shot(page, name, label) {
  const filePath = path.join(projectRoot, `e2e-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  screenshots.push({ name, label, path: filePath });
  console.log(`📸 ${label} → e2e-${name}.png`);
}

async function getLatestDocStatus(page) {
  return page.evaluate(async () => {
    const res = await fetch("/api/documents");
    if (!res.ok) return { ok: false, status: res.status, docs: [] };
    const docs = await res.json();
    const match = docs.find((d) =>
      d.originalFilename?.includes("sample-e2e"),
    );
    const latest = docs[0];
    const doc = match ?? latest;
    return {
      ok: true,
      doc: doc
        ? {
            id: doc.id,
            title: doc.title,
            status: doc.status,
            errorMessage: doc.errorMessage,
            totalCards: doc.totalCards,
            processedCards: doc.processedCards,
            originalFilename: doc.originalFilename,
          }
        : null,
    };
  });
}

async function main() {
  console.log(`\nE2E upload test → ${baseUrl}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const result = {
    baseUrl,
    startedAt: new Date().toISOString(),
    passed: false,
    error: null,
    document: null,
    screenshots,
  };

  try {
    const homeRes = await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60_000 });
    if (!homeRes?.ok()) {
      throw new Error(`Homepage returned ${homeRes?.status() ?? "no response"}`);
    }
    await shot(page, "01-home", "Library homepage");

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(samplePdf);

    await page.getByText("Uploading", { exact: false }).first().waitFor({ timeout: 30_000 }).catch(() => {});
    await shot(page, "02-uploading", "During upload");

    await page
      .getByRole("button", { name: "Choose PDF" })
      .waitFor({ state: "visible", timeout: 120_000 });
    await shot(page, "03-upload-finished", "After upload completes");

    const deadline = Date.now() + maxWaitMs;
    let lastStatus = "";
    let pollCount = 0;

    while (Date.now() < deadline) {
      const { ok, doc, status: httpStatus } = await getLatestDocStatus(page);
      if (!ok) {
        throw new Error(`GET /api/documents failed (${httpStatus})`);
      }
      if (!doc) {
        await page.waitForTimeout(pollMs);
        continue;
      }

      result.document = doc;

      if (doc.status !== lastStatus) {
        lastStatus = doc.status;
        pollCount += 1;
        const slug = `04-status-${doc.status}-${pollCount}`;
        await shot(page, slug, `Status: ${doc.status}`);
        console.log(
          `   status=${doc.status} cards=${doc.processedCards}/${doc.totalCards}`,
        );
      }

      if (doc.status === "failed") {
        throw new Error(doc.errorMessage ?? "Document processing failed.");
      }

      if (doc.status === "ready" && doc.totalCards > 0) {
        result.passed = true;
        break;
      }

      await page.waitForTimeout(pollMs);
      await page.reload({ waitUntil: "networkidle" });
    }

    if (!result.passed) {
      throw new Error(
        `Timed out after ${maxWaitMs / 1000}s waiting for ready (last: ${lastStatus || "unknown"}).`,
      );
    }

    const readLink = page.getByRole("link", { name: /continue reading|open|read/i }).first();
    if (await readLink.isVisible().catch(() => false)) {
      await readLink.click();
      await page.waitForURL(/\/documents\//, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      await shot(page, "05-reader", "Reader view");
    }

    result.finishedAt = new Date().toISOString();
    console.log("\n✅ E2E passed — no errors detected.\n");
  } catch (error) {
    result.passed = false;
    result.error = error instanceof Error ? error.message : String(error);
    result.finishedAt = new Date().toISOString();
    try {
      await shot(page, "99-error", "Error state");
    } catch {
      /* page may be closed */
    }
    console.error(`\n❌ E2E failed: ${result.error}\n`);
  } finally {
    await writeFile(
      path.join(projectRoot, "e2e-result.json"),
      JSON.stringify(result, null, 2),
    );
    await browser.close();
  }

  process.exit(result.passed ? 0 : 1);
}

main();
