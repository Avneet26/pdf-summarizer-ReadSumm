# PDF Easy Read

Turn long PDF books and research papers into easy-to-read summary cards. Upload a PDF, and the app extracts text, splits it by chapter or page, and uses OpenRouter to rewrite each section into a 100–200 word card you can swipe through.

## Stack

- **Next.js** (App Router)
- **Turso** (SQLite) via `@libsql/client` + **Drizzle ORM**
- **Cloudflare R2** for ephemeral PDF staging (S3-compatible, generous free tier)
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

**Local uploads** use same-origin upload by default (no R2 credentials needed). To test R2 uploads locally, add the R2 env vars from `.env.example`.

## Cloudflare R2 setup

1. [Create a Cloudflare account](https://dash.cloudflare.com/) and open **R2 Object Storage**.
2. Create a bucket (e.g. `pdf-reader-uploads`).
3. **R2 → Manage R2 API Tokens** → create a token with Object Read & Write on that bucket.
4. Add to `.env.local` (or Vercel env vars):
   - `R2_ACCOUNT_ID` — from the R2 overview page
   - `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — from the API token
   - `R2_BUCKET_NAME` — your bucket name
5. Configure **CORS** on the bucket so the browser can PUT uploads. Use the template in `scripts/r2-storage-cors.json` (add your production domain if different).

## Deploy on Vercel

**Live app:** [pdf-summarizer-read-summ.vercel.app](https://pdf-summarizer-read-summ.vercel.app/)

1. **Turso** — Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (Production + Preview).

2. **OpenRouter** — Add `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`.

3. **Cloudflare R2** (required for uploads on the live site):
   - Create bucket + **R2 API token** (R2 → Manage API Tokens — not Profile → API Tokens)
   - Add to Vercel **Production** and **Preview** environments:
     - `R2_ACCOUNT_ID`
     - `R2_ACCESS_KEY_ID`
     - `R2_SECRET_ACCESS_KEY`
     - `R2_BUCKET_NAME`
   - Set bucket CORS to allow your Vercel domain (see `scripts/r2-storage-cors.json`)
   - The build fails if any R2 variable is missing on Vercel

4. Optional: `NEXT_PUBLIC_APP_URL=https://pdf-summarizer-read-summ.vercel.app`

5. Deploy from `main`. After deploy, verify:

```bash
npm run verify:apis
```

Or: `node scripts/verify-vercel-apis.mjs https://pdf-summarizer-read-summ.vercel.app`

If uploads fail, confirm R2 credentials are set and bucket CORS allows PUT from your app origin.

## How uploads work

1. Browser calls `/api/documents/upload/prepare` → creates a document row and returns a presigned PUT URL.
2. Browser uploads the PDF **directly to Cloudflare R2** (supports large files).
3. Browser calls `/api/documents/upload/complete` → server downloads from R2, validates the PDF, starts processing, then deletes the staged file.

On **localhost** without R2 credentials, uploads go through `/api/documents/upload/direct` instead (limited to ~4.5 MB on Vercel; fine for local dev).

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
