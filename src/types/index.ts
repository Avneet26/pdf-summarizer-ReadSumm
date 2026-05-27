export type DocumentStatus =
  | "queued"
  | "extracting"
  | "chunking"
  | "summarizing"
  | "ready"
  | "failed";

export interface ReadingProgress {
  lastCardIndex: number;
  lastCardId: string | null;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  title: string;
  originalFilename: string;
  pageCount: number;
  status: DocumentStatus;
  totalCards: number;
  processedCards: number;
  errorMessage: string | null;
  chunkStrategy: string | null;
  accentColor: string;
  createdAt: string;
  lastCardIndex?: number | null;
}

export interface CardItem {
  id: string;
  orderIndex: number;
  subtitle: string;
  body: string;
  wordCount: number;
  sourcePages?: string;
}
