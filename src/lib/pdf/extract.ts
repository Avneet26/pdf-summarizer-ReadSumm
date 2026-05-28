import "server-only";

// Must load before pdf-parse / pdfjs-dist — polyfills DOMMatrix for Node & Vercel.
import "pdf-parse/worker";

import { PDFParse } from "pdf-parse";
import { MIN_TEXT_CHARS_PER_PAGE } from "@/lib/constants";

export interface PageText {
  num: number;
  text: string;
}

export interface ExtractedPdf {
  pages: PageText[];
  pageCount: number;
  fullText: string;
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const pages = result.pages.map((page) => ({
      num: page.num,
      text: page.text.trim(),
    }));

    const pageCount = result.total || pages.length;
    const fullText = pages.map((p) => p.text).join("\n\n").trim();

    if (fullText.length < MIN_TEXT_CHARS_PER_PAGE) {
      throw new Error(
        "This PDF appears to be image-only or has very little extractable text. OCR is not supported in v1.",
      );
    }

    const avgCharsPerPage = fullText.length / Math.max(pageCount, 1);
    if (avgCharsPerPage < MIN_TEXT_CHARS_PER_PAGE && pageCount > 1) {
      throw new Error(
        "This PDF appears to be scanned/image-only. OCR is not supported in v1.",
      );
    }

    return { pages, pageCount, fullText };
  } finally {
    await parser.destroy();
  }
}
