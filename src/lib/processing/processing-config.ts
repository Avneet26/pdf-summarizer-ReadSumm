import "server-only";

/** Wall-clock budget per invocation (leave headroom before Vercel kills the function). */
export function getProcessingTimeBudgetMs(): number {
  const fromEnv = Number(process.env.PROCESS_TIME_BUDGET_SEC);
  if (Number.isFinite(fromEnv) && fromEnv > 5) {
    return Math.floor(fromEnv * 1000);
  }
  // Default: ~50s work per 60s Hobby function
  return 50_000;
}

export function createProcessingDeadline(): number {
  return Date.now() + getProcessingTimeBudgetMs();
}

export function isPastDeadline(deadline: number): boolean {
  return Date.now() >= deadline;
}
