# PDF Easy Read

Turn long PDF books and research papers into easy-to-read summary cards. Upload a PDF, and the app extracts text, splits it by chapter or page, and uses OpenRouter to rewrite each section into a 100–200 word card you can swipe through.

## Stack

- **Next.js** (App Router)
- **Turso** (SQLite) via `@libsql/client` + **Drizzle ORM**
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

3. Configure `.env.local`:

```bash
# Local dev (no Turso cloud account needed)
TURSO_DATABASE_URL=file:local.db

# Or Turso cloud
# TURSO_DATABASE_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your-token

OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Swap `OPENROUTER_MODEL` to any model supported by OpenRouter (e.g. `openai/gpt-4o-mini`, `google/gemini-flash-1.5`).

4. Push the database schema:

```bash
npm run db:push
```

5. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. Upload a PDF on the library page.
2. The server extracts text per page (image-only/scanned PDFs are rejected in v1).
3. The app detects chapter headings when possible; otherwise it chunks by page groups.
4. Each chunk is sent to OpenRouter to produce a card: subtitle + 100–200 word easy-read paragraph.
5. Cards appear in a swipeable deck with keyboard navigation (← →).

Raw PDFs are **not stored** — only metadata, chunk text, and generated cards are saved in Turso.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Apply schema to Turso/local DB |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:studio` | Open Drizzle Studio |

## OpenRouter boilerplate

The AI client lives in `src/lib/ai/openrouter.ts`. Change the model via `OPENROUTER_MODEL` in `.env.local` — no code changes required.

Prompt template: `src/lib/ai/prompts.ts`.

## Limitations (v1)

- No auth (single-user)
- No OCR for scanned PDFs
- Large books may take several minutes to process
- Processing runs in the background after upload
