# PDF Easy Read

Turn long PDF books and research papers into easy-to-read summary cards. Upload a PDF, and the app extracts text, splits it by chapter or page, and uses OpenRouter to rewrite each section into a 100–200 word card you can swipe through.

## Stack

- **Next.js** (App Router)
- **Turso** (SQLite) via `@libsql/client` + **Drizzle ORM**
- **Vercel Blob** for ephemeral PDF staging (free tier on Hobby)
- **OpenRouter** for AI card generation (model name is configurable)
- **pdf-parse** for text extraction

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Configure `.env.local` (Turso + OpenRouter required):

```bash
TURSO_DATABASE_URL=file:local.db
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

4. Push the database schema:

```bash
npm run db:push
```

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Local uploads** use same-origin upload by default (no Blob token needed). To test Blob uploads locally, run `vercel env pull` after creating a Blob store on Vercel.

## Deploy on Vercel

**Live app:** [pdf-summarizer-read-summ.vercel.app](https://pdf-summarizer-read-summ.vercel.app/)

1. **Turso** — Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (Production + Preview).

2. **OpenRouter** — Add `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.

3. **Vercel Blob** (required for uploads on the live site):
   - Vercel project → **Storage** → **Create Database** → **Blob**
   - Link it to this project — Vercel adds `BLOB_READ_WRITE_TOKEN` automatically
   - No paid Firebase account needed

4. Optional: `NEXT_PUBLIC_APP_URL=https://pdf-summarizer-read-summ.vercel.app`

5. Deploy. The build runs `drizzle-kit push` to sync the Turso schema.

If uploads fail, confirm **Blob** is connected and `BLOB_READ_WRITE_TOKEN` appears under Project → Settings → Environment Variables.

## How uploads work

1. Browser calls `/api/documents/upload/prepare` → creates a document row.
2. Browser uploads the PDF **directly to Vercel Blob** (multipart for large files).
3. Browser calls `/api/documents/upload/complete` → server downloads the blob, validates the PDF, starts processing, then deletes the staged file.

On **localhost** without `BLOB_READ_WRITE_TOKEN`, uploads go through `/api/documents/upload/direct` instead (limited to ~4.5 MB on Vercel; fine for local dev).

## How processing works

1. Extract text per page (scanned/image-only PDFs are rejected in v1).
2. Detect chapter headings when possible; otherwise chunk by page groups.
3. Send each chunk to OpenRouter for a 100–200 word easy-read card.
4. Swipe through cards in the reader; progress is saved in Turso.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Apply schema to Turso/local DB |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Limitations (v1)

- No auth (single-user)
- No OCR for scanned PDFs
- Large books may take several minutes to process
- Processing runs in the background after upload
