const DEFAULT_CONCURRENCY = 10;
const MAX_CONCURRENCY = 20;

export function getOpenRouterConcurrency(workItemCount: number): number {
  const fromEnv = Number(process.env.OPENROUTER_CONCURRENCY);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(MAX_CONCURRENCY, fromEnv);
  }
  // Scale workers with workload: ~half the batches in flight, min 8, max 15
  return Math.min(15, Math.max(8, Math.ceil(workItemCount / 2)));
}

export function getOpenRouterBatchSize(): number {
  const fromEnv = Number(process.env.OPENROUTER_BATCH_SIZE);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(5, Math.max(1, fromEnv));
  }
  return 3;
}

export const AI_MAX_INPUT_CHARS = 4500;

export const OPENROUTER_TIMEOUT_MS = 180_000;

export const PROGRESS_FLUSH_MS = 1500;

export { DEFAULT_CONCURRENCY };
