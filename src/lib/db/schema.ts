import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalFilename: text("original_filename").notNull(),
  pageCount: integer("page_count").notNull().default(0),
  status: text("status", {
    enum: [
      "queued",
      "extracting",
      "chunking",
      "summarizing",
      "ready",
      "failed",
    ],
  })
    .notNull()
    .default("queued"),
  totalCards: integer("total_cards").notNull().default(0),
  processedCards: integer("processed_cards").notNull().default(0),
  errorMessage: text("error_message"),
  chunkStrategy: text("chunk_strategy", {
    enum: ["chapters", "pages", "hybrid"],
  }),
  accentColor: text("accent_color").notNull().default("#6366f1"),
  createdAt: text("created_at").notNull(),
});

export const chunks = sqliteTable("chunks", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  label: text("label").notNull(),
  sourcePages: text("source_pages").notNull(),
  rawText: text("raw_text").notNull(),
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  chunkId: text("chunk_id")
    .notNull()
    .references(() => chunks.id, { onDelete: "cascade" }),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull(),
  subtitle: text("subtitle").notNull(),
  body: text("body").notNull(),
  wordCount: integer("word_count").notNull().default(0),
});

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type Card = typeof cards.$inferSelect;
