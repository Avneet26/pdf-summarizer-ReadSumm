# PDF Easy Read

Turn long PDF books and research papers into easy-to-read summary cards. Upload a PDF, and the app extracts text, splits it by chapter or page, and uses OpenRouter to rewrite each section into a 100–200 word card you can swipe through.

## Stack

- **Next.js** (App Router)
- **Turso** (SQLite) via `@libsql/client` + **Drizzle ORM**
- **Firebase Storage** as ephemeral upload staging (use-and-delete)
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

# Firebase Storage (see "Firebase setup" below)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

`NEXT_PUBLIC_APP_URL` is optional. On Vercel, the app URL is detected automatically from `VERCEL_URL`.

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

## Firebase setup

The PDF itself is never sent through the Vercel serverless function — the browser uploads it directly to Firebase Storage via a short-lived signed URL, and the server only downloads it to extract text, then deletes the staged object. This sidesteps the Vercel ~4.5 MB request-body limit that otherwise causes mobile uploads to 413.

1. Create (or reuse) a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/).
2. Enable **Storage** for the project (any default location is fine).
3. Open **Project settings → Service accounts → Generate new private key** and download the JSON file. Copy the values into your env:
   - `FIREBASE_PROJECT_ID` ← `project_id`
   - `FIREBASE_CLIENT_EMAIL` ← `client_email`
   - `FIREBASE_PRIVATE_KEY` ← `private_key` (the literal `\n` sequences in the JSON are fine; they're restored to real newlines at runtime).
   - `FIREBASE_STORAGE_BUCKET` ← the bucket name shown on the **Storage** screen (usually `<project-id>.appspot.com`).
4. Configure CORS on the bucket so the browser can `PUT` to the signed URL. Save the following to `cors.json` and run `gsutil cors set cors.json gs://<your-bucket>`:

   ```json
   [
     {
       "origin": ["http://localhost:3000", "https://your-deployed-app.example.com"],
       "method": ["PUT"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

   (Add every origin your app is served from.)
5. The default Firebase Storage security rules are fine: signed URLs bypass them, and the client never reads from the bucket directly.

## How it works

1. The browser requests a signed upload URL from `/api/documents/upload/sign`.
2. The PDF is `PUT` directly to Firebase Storage (no Vercel function in the data path), with live upload progress.
3. The browser calls `/api/documents/upload/complete`; the server downloads the staged object, validates the PDF magic bytes, kicks off processing, and deletes the staged object once processing finishes (success or failure).
4. The server extracts text per page (image-only/scanned PDFs are rejected in v1).
5. The app detects chapter headings when possible; otherwise it chunks by page groups.
6. Each chunk is sent to OpenRouter to produce a card: subtitle + 100–200 word easy-read paragraph.
7. Cards appear in a swipeable deck with keyboard navigation (← →).

Raw PDFs are **not stored** long-term — Firebase only holds them while processing runs, and only metadata, chunk text, and generated cards are saved in Turso.

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
