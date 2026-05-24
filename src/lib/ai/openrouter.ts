import "server-only";

import {
  AI_MAX_INPUT_CHARS,
  OPENROUTER_TIMEOUT_MS,
} from "@/lib/ai/config";
import {
  buildBatchCardPrompt,
  buildCardPrompt,
  trimForAi,
  type BatchChunkInput,
} from "@/lib/ai/prompts";
import { getAppRefererUrl } from "@/lib/utils/app-url";
import { countWords } from "@/lib/utils/word-count";

export interface GeneratedCard {
  subtitle: string;
  body: string;
  wordCount: number;
}

function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet";
  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local to generate cards.",
    );
  }

  return { apiKey, model, baseUrl };
}

function toGeneratedCard(raw: { subtitle?: string; body?: string }): GeneratedCard {
  if (!raw.subtitle?.trim() || !raw.body?.trim()) {
    throw new Error("OpenRouter response missing subtitle or body.");
  }
  const body = raw.body.trim();
  return {
    subtitle: raw.subtitle.trim(),
    body,
    wordCount: countWords(body),
  };
}

function parseCardResponse(content: string): GeneratedCard {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("OpenRouter response did not contain JSON.");
  }
  return toGeneratedCard(JSON.parse(jsonMatch[0]));
}

function parseBatchCardResponse(content: string, expected: number): GeneratedCard[] {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("OpenRouter batch response did not contain JSON.");
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    cards?: Array<{ subtitle?: string; body?: string }>;
  };

  if (!Array.isArray(parsed.cards) || parsed.cards.length !== expected) {
    throw new Error(
      `Expected ${expected} cards, got ${parsed.cards?.length ?? 0}.`,
    );
  }

  return parsed.cards.map(toGeneratedCard);
}

async function callOpenRouter(
  prompt: string,
  logLabel: string,
): Promise<string> {
  const { apiKey, model, baseUrl } = getOpenRouterConfig();
  const started = Date.now();

  console.log(`[OpenRouter] Request → model: ${model}, ${logLabel}`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": getAppRefererUrl(),
      "X-Title": "PDF Easy Read",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[OpenRouter] Error ${response.status} (${elapsed}s) — ${logLabel}: ${errorText.slice(0, 200)}`,
    );
    throw new Error(
      `OpenRouter request failed (${response.status}): ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    console.error(`[OpenRouter] Empty response (${elapsed}s) — ${logLabel}`);
    throw new Error("OpenRouter returned an empty response.");
  }

  console.log(`[OpenRouter] OK (${elapsed}s) — ${logLabel}`);
  return content;
}

export async function generateCard(
  documentTitle: string,
  chunkLabel: string,
  chunkText: string,
): Promise<GeneratedCard> {
  const text = trimForAi(chunkText, AI_MAX_INPUT_CHARS);
  const content = await callOpenRouter(
    buildCardPrompt(documentTitle, chunkLabel, text),
    `section: "${chunkLabel}"`,
  );
  const card = parseCardResponse(content);
  console.log(
    `[OpenRouter] Card ready — "${chunkLabel}" → "${card.subtitle}" (${card.wordCount} words)`,
  );
  return card;
}

export async function generateCardsBatch(
  documentTitle: string,
  sections: BatchChunkInput[],
): Promise<GeneratedCard[]> {
  if (sections.length === 0) return [];
  if (sections.length === 1) {
    return [
      await generateCard(documentTitle, sections[0].label, sections[0].text),
    ];
  }

  const trimmed = sections.map((s) => ({
    label: s.label,
    text: trimForAi(s.text, AI_MAX_INPUT_CHARS),
  }));

  const labels = trimmed.map((s) => s.label).join(", ");
  const content = await callOpenRouter(
    buildBatchCardPrompt(documentTitle, trimmed),
    `batch (${sections.length}): ${labels}`,
  );

  const cards = parseBatchCardResponse(content, sections.length);
  console.log(
    `[OpenRouter] Batch ready — ${cards.length} cards: ${cards.map((c) => c.subtitle).join(" | ")}`,
  );
  return cards;
}

export function getConfiguredModel(): string {
  return process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet";
}
