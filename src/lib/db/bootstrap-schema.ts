import type { Client } from "@libsql/client";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS documents (
    id text PRIMARY KEY NOT NULL,
    title text NOT NULL,
    original_filename text NOT NULL,
    page_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'queued' NOT NULL,
    total_cards integer DEFAULT 0 NOT NULL,
    processed_cards integer DEFAULT 0 NOT NULL,
    error_message text,
    chunk_strategy text,
    accent_color text DEFAULT '#6366f1' NOT NULL,
    created_at text NOT NULL,
    upload_object_path text
  )`,
  `CREATE TABLE IF NOT EXISTS chunks (
    id text PRIMARY KEY NOT NULL,
    document_id text NOT NULL,
    order_index integer NOT NULL,
    label text NOT NULL,
    source_pages text NOT NULL,
    raw_text text NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE TABLE IF NOT EXISTS cards (
    id text PRIMARY KEY NOT NULL,
    chunk_id text NOT NULL,
    document_id text NOT NULL,
    order_index integer NOT NULL,
    subtitle text NOT NULL,
    body text NOT NULL,
    word_count integer DEFAULT 0 NOT NULL,
    FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE TABLE IF NOT EXISTS reading_progress (
    user_id text NOT NULL,
    document_id text NOT NULL,
    last_card_index integer DEFAULT 0 NOT NULL,
    last_card_id text,
    updated_at text NOT NULL,
    PRIMARY KEY (user_id, document_id),
    FOREIGN KEY (document_id) REFERENCES documents(id) ON UPDATE no action ON DELETE cascade
  )`,
] as const;

const COLUMN_PATCHES = [
  { table: "documents", column: "upload_object_path", sql: "text" },
] as const;

async function tableHasColumn(
  client: Client,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function ensureColumns(client: Client): Promise<void> {
  for (const patch of COLUMN_PATCHES) {
    const exists = await tableHasColumn(client, patch.table, patch.column);
    if (exists) continue;
    await client.execute(
      `ALTER TABLE ${patch.table} ADD COLUMN ${patch.column} ${patch.sql}`,
    );
  }
}

/** Creates tables if missing. Patches older schemas with new columns. */
export async function bootstrapSchema(client: Client): Promise<void> {
  for (const sql of STATEMENTS) {
    await client.execute(sql);
  }
  await ensureColumns(client);
}
