export function trimForAi(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[...content trimmed for faster processing]`;
}

export function buildCardPrompt(
  documentTitle: string,
  chunkLabel: string,
  chunkText: string,
): string {
  return `You are rewriting a section of a document into an easy-to-read summary card.

Document title: "${documentTitle}"
Section: ${chunkLabel}

Rewrite the following text as a clear, engaging paragraph that is fast to read but preserves important details — names, facts, arguments, and conclusions should not be lost.

Requirements:
- Return valid JSON only: { "subtitle": "...", "body": "..." }
- subtitle: a short, descriptive heading (5–12 words)
- body: one flowing paragraph of 100–200 words in plain language
- Do not use bullet lists unless the source critically depends on them
- Do not mention that you are summarizing or rewriting

Source text:
"""
${chunkText}
"""`;
}

export interface BatchChunkInput {
  label: string;
  text: string;
}

export function buildBatchCardPrompt(
  documentTitle: string,
  sections: BatchChunkInput[],
): string {
  const sectionBlocks = sections
    .map(
      (section, i) =>
        `Section ${i + 1} — ${section.label}:\n"""\n${section.text}\n"""`,
    )
    .join("\n\n");

  return `You are rewriting multiple sections of a document into easy-to-read summary cards.

Document title: "${documentTitle}"

Rewrite EACH section below as a clear, engaging paragraph that is fast to read but preserves important details.

Requirements:
- Return valid JSON only: { "cards": [ { "subtitle": "...", "body": "..." }, ... ] }
- One card per section, in the same order (${sections.length} cards total)
- subtitle: a short, descriptive heading (5–12 words)
- body: one flowing paragraph of 100–200 words in plain language
- Do not use bullet lists unless the source critically depends on them

${sectionBlocks}`;
}
