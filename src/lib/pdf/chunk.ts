import {
  MAX_CHUNK_CHARS,
  MIN_CHUNK_WORDS,
  PAGE_CHUNK_SIZE,
} from "@/lib/constants";
import type { PageText } from "@/lib/pdf/extract";
import {
  detectSections,
  hasReliableSections,
  type DetectedSection,
} from "@/lib/pdf/detect-chapters";
import { countWords } from "@/lib/utils/word-count";

export type ChunkStrategy = "chapters" | "pages" | "hybrid";

export interface TextChunk {
  label: string;
  sourcePages: string;
  rawText: string;
}

function formatPageRange(start: number, end: number): string {
  return start === end ? `${start}` : `${start}–${end}`;
}

function buildPageChunks(pages: PageText[]): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (let i = 0; i < pages.length; i += PAGE_CHUNK_SIZE) {
    const slice = pages.slice(i, i + PAGE_CHUNK_SIZE);
    const startPage = slice[0]?.num ?? 1;
    const endPage = slice[slice.length - 1]?.num ?? startPage;
    const rawText = slice.map((p) => p.text).join("\n\n").trim();

    if (!rawText) continue;

    chunks.push({
      label: `Pages ${formatPageRange(startPage, endPage)}`,
      sourcePages: formatPageRange(startPage, endPage),
      rawText,
    });
  }

  return chunks;
}

function buildChapterChunks(
  pages: PageText[],
  sections: DetectedSection[],
): TextChunk[] {
  const fullText = pages.map((p) => p.text).join("\n\n");
  const chunks: TextChunk[] = [];

  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    const next = sections[i + 1];
    const start = current.startCharIndex;
    const end = next?.startCharIndex ?? fullText.length;
    const rawText = fullText.slice(start, end).trim();

    if (!rawText) continue;

    const startPage = current.startPage;
    const endPage = next
      ? pages.find((p) => p.num >= next.startPage)?.num ?? pages.at(-1)?.num ?? startPage
      : pages.at(-1)?.num ?? startPage;

    chunks.push({
      label: current.label,
      sourcePages: formatPageRange(startPage, endPage),
      rawText,
    });
  }

  return chunks;
}

function splitOversizedChunk(chunk: TextChunk): TextChunk[] {
  if (chunk.rawText.length <= MAX_CHUNK_CHARS) return [chunk];

  const paragraphs = chunk.rawText.split(/\n\n+/).filter(Boolean);
  const result: TextChunk[] = [];
  let buffer = "";
  let part = 1;

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > MAX_CHUNK_CHARS && buffer) {
      result.push({
        label: `${chunk.label} (part ${part})`,
        sourcePages: chunk.sourcePages,
        rawText: buffer.trim(),
      });
      buffer = paragraph;
      part += 1;
    } else {
      buffer = candidate;
    }
  }

  if (buffer.trim()) {
    result.push({
      label: part > 1 ? `${chunk.label} (part ${part})` : chunk.label,
      sourcePages: chunk.sourcePages,
      rawText: buffer.trim(),
    });
  }

  return result.length ? result : [chunk];
}

function mergeTinyChunks(input: TextChunk[]): TextChunk[] {
  if (input.length <= 1) return input;

  const merged: TextChunk[] = [];
  let pending: TextChunk | null = null;

  for (const chunk of input) {
    if (!pending) {
      pending = { ...chunk };
      continue;
    }

    const pendingWords = countWords(pending.rawText);
    if (pendingWords < MIN_CHUNK_WORDS) {
      pending = {
        label: pending.label,
        sourcePages: `${pending.sourcePages}, ${chunk.sourcePages}`,
        rawText: `${pending.rawText}\n\n${chunk.rawText}`.trim(),
      };
    } else {
      merged.push(pending);
      pending = { ...chunk };
    }
  }

  if (pending) merged.push(pending);
  return merged;
}

export function chunkPdfText(pages: PageText[]): {
  chunks: TextChunk[];
  strategy: ChunkStrategy;
} {
  const sections = detectSections(pages);
  let baseChunks: TextChunk[];
  let strategy: ChunkStrategy;

  if (hasReliableSections(sections, pages.length)) {
    baseChunks = buildChapterChunks(pages, sections);
    strategy = "chapters";
  } else if (sections.length >= 2) {
    baseChunks = buildChapterChunks(pages, sections);
    if (baseChunks.some((c) => countWords(c.rawText) < MIN_CHUNK_WORDS)) {
      baseChunks = buildPageChunks(pages);
      strategy = "hybrid";
    } else {
      strategy = "hybrid";
    }
  } else {
    baseChunks = buildPageChunks(pages);
    strategy = "pages";
  }

  const split = baseChunks.flatMap(splitOversizedChunk);
  const merged = mergeTinyChunks(split);

  return { chunks: merged, strategy };
}
