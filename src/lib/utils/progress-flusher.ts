import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { PROGRESS_FLUSH_MS } from "@/lib/ai/config";

export class ProgressFlusher {
  private count = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> = Promise.resolve();

  constructor(private documentId: string) {}

  increment(by = 1) {
    this.count += by;
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushing = this.flush();
    }, PROGRESS_FLUSH_MS);
  }

  async flush() {
    const value = this.count;
    await db
      .update(documents)
      .set({ processedCards: value })
      .where(eq(documents.id, this.documentId));
  }

  async finalize() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flushing;
    await this.flush();
    return this.count;
  }
}
