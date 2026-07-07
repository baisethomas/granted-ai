---
description: Diagnose the document ingestion pipeline stage by stage — names the broken stage and the single next action
---

Use when a symptom points at ingestion or retrieval: "document stuck processing", "draft came back needs_context", "no citations", "generation ignores my uploads". The pipeline has five stages — **upload → extract → chunk → embed → retrieve** — and each fails differently. This command gathers evidence for all five at once, then walks a decision tree instead of guessing.

## 1. Gather evidence (read-only)

Write this one-off script to the scratchpad (NOT the repo) and run it with `npx tsx`. It uses the lazy `getSql()` client from `server/db.ts` and runs **only SELECTs** — never add writes to a diagnostic:

```ts
import "../server/config.js"; // adjust relative path from the scratchpad, or copy env loading
import { getSql } from "<repo>/server/db.js";

const sql = getSql();
if (!sql) throw new Error("DATABASE_URL not set");

const [docs, jobs, extractions, chunkless, vectorless, cache] = [
  await sql`select embedding_status, processed, count(*) from documents group by 1, 2`,
  await sql`select status, count(*), max(attempts) as max_attempts,
            (array_agg(last_error) filter (where last_error is not null))[1] as sample_error
            from document_processing_jobs group by 1`,
  await sql`select extraction_status, count(*), avg(raw_text_bytes)::int as avg_bytes
            from document_extractions group by 1`,
  await sql`select d.id, d.original_name from documents d
            left join doc_chunks c on c.document_id = d.id
            where d.processed = true group by d.id, d.original_name
            having count(c.id) = 0 limit 10`,
  await sql`select count(*) from doc_chunks where embedding is null`,
  await sql`select count(*) from embedding_cache`,
];
console.log(JSON.stringify({ docs, jobs, extractions, chunkless, vectorless, cache }, null, 2));
await sql.end();
```

If a column in the script doesn't match the live schema (drift), check `shared/schema-simple.ts` for the real column name and fix the query — then note the drift.

Also check the environment: `OPENAI_API_KEY` present and `sk-`-prefixed? `DATABASE_URL` pointing where you think? (`grep -c . .env.local` — never print values.)

## 2. Decision tree — first matching row wins

| Evidence | Broken stage | The fix |
|---|---|---|
| Extraction `failed`, or `raw_text` starts with `[Error processing PDF` | **Extract** | Likely a scanned/image PDF — **OCR is not implemented** (`unpdf` handles text PDFs only). Tell the user the file needs a text-based PDF or DOCX. Not a code bug unless the file is genuinely text-based — then debug `server/pdfExtract.ts` / `fileProcessor.ts` with the actual file. |
| Extraction `complete` but ~0 `avg_bytes` | **Extract** | The file parsed but yielded no text (empty doc, or an unsupported format that fell through to a placeholder string). Check `documents.mime_type` for that doc against the branches in `fileProcessor.processFile`. |
| Jobs stuck `queued`, attempts 0 | **Worker never ran** | Nothing triggers it automatically in dev. Run `npm run doc:process`. In prod: Vercel cron hits `GET /api/cron/process-documents` (needs `CRON_SECRET`); manual trigger needs `DOCUMENT_WORKER_API_KEY`. Check those env vars in the deployment before touching code. |
| Jobs `failed` with embedding/API error in `sample_error` | **Embed** | `OPENAI_API_KEY` missing/invalid/rate-limited at worker runtime, or the model name in `DOCUMENT_EMBEDDING_MODEL` is wrong. `generateEmbedding()` throws on API errors (it only degrades to null when the key is absent). Fix the env, then re-run the worker — jobs retry. |
| Docs `processed` but in the `chunkless` list | **Chunk** | Extraction text existed but `chunkText()` produced nothing (whitespace-only text) or chunks were deleted without re-processing. Re-enqueue via `POST /api/documents/:id/reprocess`. |
| `doc_chunks` rows with `embedding is null` > 0 | **Embed (partial)** | Chunks stored without vectors — semantic search will silently skip them; only keyword search can find them. Re-run the worker after fixing the key; confirm the count drops to 0. |
| All counts healthy but generation returns `needs_context` | **Retrieve** | Check in order: (a) the query's org/project scoping — chunks belong to the org you're querying as? (b) similarity floor — semantic-only hits below 0.3 are dropped by design; (c) the user's `contextUsage` setting shrinking limits via `retrievalLimitsFromContextUsage`; (d) `embeddingGenerated: false` in the generate route's log line = query embedding failed (key issue), so only keyword search ran. The log line `[generate q=...] retrieved N chunks (semantic=…, keyword=…, topSim=…)` in the server output tells you which. |
| Everything healthy, drafts still weak | **Not the pipeline** | Run `/rag-eval` — the problem is generation quality, not ingestion. |

## 3. Report

State: (1) the broken stage, (2) the evidence rows that prove it, (3) the single next action, (4) whether it's an env/ops issue or a code bug. If it's a code bug, name the file and function; if you then fix it, that fix follows the normal workflow — branch, tests, `/pr`. Do not "fix" data by hand-editing rows; re-run the pipeline so the fix is reproducible.
