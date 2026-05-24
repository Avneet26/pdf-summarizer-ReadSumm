import type { PageText } from "@/lib/pdf/extract";

export interface DetectedSection {
  label: string;
  startPage: number;
  startCharIndex: number;
}

const CHAPTER_PATTERNS = [
  /^(?:chapter|part|section|book)\s+[\divxlcdm]+(?:[:\.\-\s]|$)/i,
  /^(?:chapter|part|section|book)\s+\d+(?:[:\.\-\s]|$)/i,
  /^\d+(?:\.\d+)*\.?\s+[A-Z][^\n]{0,80}$/,
  /^[A-Z][A-Z0-9\s\-:]{3,60}$/,
];

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  return CHAPTER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function detectSections(pages: PageText[]): DetectedSection[] {
  const sections: DetectedSection[] = [];
  let charOffset = 0;

  for (const page of pages) {
    const lines = page.text.split("\n");

    for (const line of lines) {
      if (isLikelyHeading(line)) {
        const label = line.trim().replace(/\s+/g, " ");
        const alreadyExists = sections.some(
          (s) => s.label.toLowerCase() === label.toLowerCase(),
        );
        if (!alreadyExists) {
          sections.push({
            label,
            startPage: page.num,
            startCharIndex: charOffset + page.text.indexOf(line),
          });
        }
      }
    }

    charOffset += page.text.length + 2;
  }

  return sections.sort((a, b) => a.startCharIndex - b.startCharIndex);
}

export function hasReliableSections(
  sections: DetectedSection[],
  pageCount: number,
): boolean {
  if (sections.length < 2) return false;
  const avgPagesPerSection = pageCount / sections.length;
  return avgPagesPerSection >= 2 && sections.length <= pageCount;
}
