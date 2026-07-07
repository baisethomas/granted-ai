# Granted AI — Operating Manual

This file is the contract for any model working in this repo. It is written so you can follow it mechanically: every rule is checkable, every known failure mode is named, and every "when unsure" case has an exact instruction. When this file and any other doc disagree, this file wins. When this file and the code disagree, the code wins — and you fix this file in the same session.

## What this app is

Granted is a grant-writing assistant. Users upload their org's documents (mission statements, past proposals, budgets), add grant questions to a project, and the system generates grounded, cited answers — **one question at a time** — with assumption tags where a claim can't be sourced.

Target user: the executive director of a small nonprofit who writes grants themselves. Positioning: **"grant drafts you can defend."** The audience is skeptical of AI hallucination, so grounding and honesty about assumptions ARE the product, not a feature. When prioritizing, favor draft quality, citation verifiability, and honest gap behavior over new infrastructure or multi-user features.

Currently in **Phase 3 (RAG Core)** of a 6-phase build (`PROJECT_ROADMAP.md`). Phases 1–2 (Auth, Ingestion) are done. Phase 4 (Clarification engine, Evidence Map) is next and **not built**.

---

## The workflow — every session, no exceptions

1. **Branch before touching any code.** Run `/start` (or manually: pull main, `git checkout -b feat/GRA-<id>-<slug>` / `fix/GRA-<id>-<slug>` / `chore/<slug>`, push upstream). If you find yourself on `main` with uncommitted changes, **stop and ask** before doing anything else.
2. **Plan before building anything new.** `/new-feature` for features; for smaller work, state which files you'll touch before touching them.
3. **Work.** Follow the conventions and rules below.
4. **Verify.** Run the quality-bar checklist for your deliverable type (below) — all items, not a sample.
5. **Ship via PR.** `/pr` opens it. Code is not shipped until a PR exists.
6. **Merge only through `/review`.** The gate is **Codex** (`chatgpt-codex-connector`, an external GPT reviewer, not Claude). It posts P1/P2/P3 findings; you fix every P1/P2, re-trigger, repeat until clean; a clean pass auto-merges (squash). Never merge by hand. Never bypass a P1/P2. The local `pr-reviewer` agent is an optional free pre-pass — it is not the gate, because it's Claude grading Claude.
7. **After any structural change, run `/sync-docs`** (new/renamed/deleted files or services, schema change, endpoint change, new env var, completed phase). Doc drift is a recurring, expensive failure in this repo.

Commit style (from history): imperative subject ≤ 72 chars, prefixed with the Linear ID when there is one (`GRA-52: Catch fabricated named entities…`). Review-round commits: `review: address Codex round <k>`. One issue per PR; small, focused diffs.

---

## Never-break rules

These are absolute. A PR that violates one is broken regardless of what else it does.

1. **Never fabricate citations.** Every grounded claim maps to a real `doc_chunks` row via `draft_citations`. Unsourceable facts become `assumption_labels` entries. All model-emitted citations pass through `normalizeGroundedCitations()` in `server/services/ai.ts`; `findUnsupportedSpecifics()` additionally flags named entities the cited chunk doesn't contain. Never construct a citation from anything except a retrieved chunk.
2. **Never call an LLM without a plan check first.** Every token-spending path is gated with `billingService.checkLimit(userId, "ai_tokens", estimatedTokens, organizationId)` **before** the call, and records the spend with `billingService.recordUsage(...)` + `calculateCostCents(...)` after. Same pattern for `"projects"` and `"documents"` limits on those routes. Retries and background jobs spend tokens too — they are not exempt.
3. **Never expose provider keys client-side.** `OPENAI_API_KEY` and all `SUPABASE_SERVICE_ROLE*` / `STRIPE_*` secrets are server-only. The only key that reaches the browser is the Supabase anon key.
4. **Never use `Promise.all` for multi-source retrieval or fan-out** — use `Promise.allSettled` so one failure doesn't kill the response.
5. **Never write migrations by hand and never define schema outside `shared/schema-simple.ts`.** Edit `schema-simple.ts`, then `npm run db:push`. `/migrations/` files are generated. `shared/schema.ts` is a thin re-export kept for legacy imports — never add tables or columns there.
6. **Never bypass tenant isolation.** Every query on user data filters by `organizationId`. Data access goes through `server/storage.ts` methods — no raw Drizzle in routes. Every route handling org data verifies access (`storage.userHasOrganizationAccess(userId, organizationId)` or a storage method that scopes internally).
7. **Never commit or push to `main`.** See workflow above.
8. **Never merge an unreviewed PR.** A clean Codex pass is the only thing that clears the gate.

---

## Named mistakes and the rule that prevents each

These are the specific ways models have gone (or will go) wrong in this codebase. Check your diff against every one it touches.

### Mistake 1: Trusting the model's citations
The LLM returns a `citations` array. It routinely echoes marker positions as chunk indexes, invents quotes, and — worse — writes accurate citations next to prose containing invented specifics (GRA-52: the source said "three counties," the draft named three plausible counties).
**Rule:** any code path that produces citations must route model output through `normalizeGroundedCitations(rawCitations, retrievedChunks)` (drops anything untraceable, verifies quotes verbatim) and run `findUnsupportedSpecifics(text, retrievedChunks)` on the prose, surfacing hits as assumptions. If you change generation output shape, update these two functions and `server/services/ai.citations.test.ts` in the same PR.

### Mistake 2: The free LLM call
Adding an `openai.*` or `aiService.*` call in a new route, worker, or script without the billing gate — especially "small" calls (summaries, extractions, retries).
**Rule:** the literal pattern, in this order, for every token-spending path:
```ts
const limitCheck = await billingService.checkLimit(userId, "ai_tokens", estimatedTokens, organizationId);
if (!limitCheck.allowed) return sendLimitDenial(res, limitCheck.denial);
// ... call aiService ...
await billingService.recordUsage({ organizationId, userId, projectId, type, provider, model,
  tokensIn, tokensOut, costCents: calculateCostCents(model, tokensIn, tokensOut), metadata });
```
See `POST /api/questions/:id/generate` (`server/routes.ts:1512`) for the canonical implementation, including `estimateGenerationTokens(...)`.

### Mistake 3: `Promise.all` on fan-out
One rejected promise nukes the whole response — for retrieval that means one bad document kills a draft.
**Rule:** `Promise.allSettled` for anything concurrent that touches multiple sources; use fulfilled results; log rejected ones.

### Mistake 4: Editing the wrong schema file, or hand-editing migrations
`shared/schema.ts` looks like the schema. It isn't — it's a pass-through re-export of `schema-simple.ts` (kept so old `server/*` imports still type-check). `/migrations/*.sql` look editable. They're generated.
**Rule:** tables and columns are defined in `shared/schema-simple.ts` only (confirmed by `drizzle.config.ts`); apply with `npm run db:push`. New tables need a primary key, `created_at`, and an `organizationId` FK. pgvector columns are `vector(..., { dimensions: 1536 })` and require the `vector` extension (`enable_vector.sql`). After a schema change, update `server/storage.ts` methods, then callers — in that order.

### Mistake 5: The tenant leak
Writing a Drizzle query directly in a route, or a `storage.ts` method that filters by `userId` but not `organizationId` (or vice versa). Grant documents are sensitive nonprofit data; a cross-tenant leak is the worst bug this product can have.
**Rule:** routes never import `db`; they call `server/storage.ts`. Any new storage method on user data takes and filters by `organizationId`. Any new route on org resources calls `storage.userHasOrganizationAccess(userId, organizationId)` before reading or writing.

### Mistake 6: Missing auth on a new route
Every protected route uses `requireSupabaseUser` from `server/middleware/supabaseAuth.ts` (Supabase JWT via `Authorization: Bearer` header **only** — the query-param token fallback was deliberately removed for security; do not reintroduce it). Unauthenticated exceptions are exactly: the Stripe webhook, the worker trigger, and the cron endpoint (rate-limited instead).
**Rule:** new route → `requireSupabaseUser` in the middleware chain, `getUserId(req)` for identity. Don't add Passport strategies; `server/auth.ts` is a legacy fallback.

### Mistake 7: Trusting the planning docs
The repo has ~20 planning docs (`PRD.md`, `*_PLAN.md`, roadmaps). They describe intent, and they drift. Docs have previously pointed at files that don't exist (`api/simple.ts`) and features that were never built.
**Rule:** the code is the source of truth. Before acting on any doc claim about where something lives or whether it exists, verify with a grep/read. If you find drift, fix the doc (or the "Reality vs. the docs" list below) in the same session — drift compounds.

### Mistake 8: Assuming capabilities that don't exist
Specifically: **OCR is not implemented** (only text-PDF extraction via `unpdf`, DOCX via `mammoth`); **the app is OpenAI-only** (the `@anthropic-ai/sdk` dependency is installed but unused — deliberately, see `docs/DECISIONS.md` 2026-06-30); **there is no `drafts` table** (answers live on `questions.response` + `response_versions`); **there is no `clarifications` table** (Phase 4).
**Rule:** don't write code against these phantoms; don't "helpfully" wire up Anthropic or a provider abstraction without being asked — that decision has documented revisit triggers.

### Mistake 9: Blocking the request cycle with pipeline work
Extract → chunk → embed can take minutes.
**Rule:** long work goes through `document_processing_jobs` and `server/workers/documentProcessor.ts`, triggered by `POST /api/workers/process-documents` or the Vercel cron. Request handlers only enqueue and report status. Never `await` document processing inside an upload route.

### Mistake 10: 500ing on best-effort writes
In the generate route, persisting citations, assumptions, and response versions is deliberately wrapped in try/catch-warn: the user must still get their draft if a side-table write fails (e.g. schema drift on a stale DB).
**Rule:** preserve this pattern. The draft response and its `usage_events` row are load-bearing; `draft_citations` / `assumption_labels` / `response_versions` writes are best-effort. Don't "clean up" the try/catches into a transaction that fails the whole request.

### Mistake 11: "Improving" generation output into markdown
The drafts UI renders plain text with `[#N]` citation markers; `stripMarkdown()` strips formatting except when the user chose the bulleted structure.
**Rule:** generated answer text stays plain text with inline `[#N]` markers. Don't emit markdown from the prompt; don't remove `stripMarkdown()`; don't change the `[#N]` convention without updating `normalizeGroundedCitations`, `findUnsupportedSpecifics`, the drafts-page citation display, and their tests together.

### Mistake 12: Breaking the retrieval invariants
Retrieval (`server/services/retrieval.ts`) is hybrid on purpose: semantic (pgvector cosine) + keyword. Two invariants look like bugs to a fresh reader and are not:
- **Keyword hits bypass the similarity floor** (`minSimilarity` 0.3 applies to semantic-only hits) — a literal keyword match is itself strong evidence.
- **A keyword hit upgrades retention** of a chunk already seen semantically with low similarity.
**Rule:** preserve both when editing retrieval; `server/services/retrieval.test.ts` encodes them — run it. Defaults: limit 8, semanticLimit 8, keywordLimit 4 (scaled by the user's `contextUsage` setting via `retrievalLimitsFromContextUsage`).

### Mistake 13: Invalidating vectors silently
Changing the embedding model, chunk size (1200 chars), or overlap (200) makes existing `doc_chunks` vectors incomparable with new query embeddings.
**Rule:** any change to embedding model or chunking strategy requires a plan to re-index `doc_chunks` and clear `embedding_cache`, stated in the PR. Dims are 1536 (`text-embedding-3-small`) and are baked into two pgvector columns.

### Mistake 14: Reaching for the wrong client-state tool
`zustand` is installed but **unused** — don't be the one who uses it.
**Rule:** server state = TanStack Query; local state = React hooks. Routing is `wouter`, not react-router. Path aliases: `@/` → `client/src`, `@shared/` → `shared`.

### Mistake 15: Raw styling and raw buttons
**Rule:** primary brand color `#2186EB` is reached via `text-primary` / `bg-primary` CSS vars — never `bg-blue-600` or hex literals. Buttons are always `<Button variant="...">` from `client/src/components/ui/button.tsx`. Radix + shadcn primitives live in `client/src/components/ui/`. Fonts: Open Sans (UI), JetBrains Mono (code/hints). Full reference: `docs/design-system.md`.

### Mistake 16: Copy that sells instead of serves
The audience is skeptical grant professionals.
**Rule (checkable):** never the phrase "AI-powered" in UI copy; every error message = what happened + what to do next; every empty state names the next action; headings active ("Upload your documents"), button labels verbs ("Generate draft"). Run `/copy-review` before shipping user-facing text. Full voice guide: `.claude/agents/brand-voice.md`.

### Mistake 17: Declaring done without running the gates
**Rule:** nothing is "done" until the commands in the quality bar below have been run in this session and their output reported honestly. If a test fails, say so with the output — never summarize a red run as "mostly passing."

### Mistake 18: Starting a second dev server
Express serves Vite in middleware mode (`server/vite.ts`); there is no separate Vite dev server.
**Rule:** `npm run dev` = the whole app on **port 5001** (5000 is avoided — macOS AirPlay). Entry: `server/index.ts`. If 5001 is busy, find the existing process; don't change the port.

---

## Ground truth map (verified 2026-07-06 — re-verify details before relying on them)

**Stack:** Vite + React 18 · Express + TypeScript via `tsx` · PostgreSQL + Drizzle ORM (`postgres-js` driver, `DATABASE_URL` typically the Supabase transaction pooler on :6543) · Supabase Auth + Storage · pgvector · Stripe · OpenAI.

**Request → data flow:**
```
client (/api/* via TanStack Query, Bearer token from Supabase session)
  → Express route in server/routes.ts   (~2,650 lines; requireSupabaseUser)
    → billingService.checkLimit(...)     (server/services/billing.ts)
    → server/storage.ts                  (THE data-access layer over Drizzle — 83KB;
                                          top-level server/, NOT server/services/)
    → server/services/ai.ts              (AIService singleton: generation, grounding,
                                          normalizeGroundedCitations, findUnsupportedSpecifics)
```

**The per-question generate flow (the core of the product):**
```
Create project → add questions (grantQuestions → SQL table "questions")
  → POST /api/questions/:id/generate            (routes.ts:1512 — the canonical route)
      plan check → retrieveRelevantChunks → generateGroundedResponse
      → recordUsage → response_versions row + draft_citations + assumption_labels
      → 200 (complete) or 206 (needs_context / degraded, with warning + canRetry)
Retry:           POST /api/questions/:id/retry            (also plan-checked)
Manual edit:     PUT  /api/questions/:id/response
Versions:        GET  /api/questions/:questionId/versions
                 POST /api/questions/:questionId/versions/:versionId/current
```
Question `responseStatus` values: `pending | generating | complete | failed | timeout | needs_context`.

**Async document pipeline:** upload route stores file + enqueues → `server/workers/documentProcessor.ts` (extract via `services/fileProcessor.ts` → chunk 1200 chars / 200 overlap via `chunkText` → embed, batch 5) → job state in `document_processing_jobs`, text in `document_extractions`, vectors in `doc_chunks`, cache in `embedding_cache`. Local run: `npm run doc:process`.

**Runtime LLM config:** generation `GRANTED_DEFAULT_MODEL` (default `gpt-4o-mini`; `summarizeDocument` / `extractQuestions` / `extractMetrics` hardcode `gpt-4o`). Embeddings `DOCUMENT_EMBEDDING_MODEL` (default `text-embedding-3-small`, 1536 dims). All paths degrade gracefully to mock/null output when no API key is set.

**Schema (canonical: `shared/schema-simple.ts`)** — Drizzle export → SQL name:
`users`, `organizations`, `memberships`, `subscriptions`, `projects`, `documents`, `documentExtractions`→`document_extractions`, `docChunks`→`doc_chunks` (pgvector 1536), `documentProcessingJobs`→`document_processing_jobs`, `draftCitations`→`draft_citations`, `assumptionLabels`→`assumption_labels`, `embeddingCache`→`embedding_cache` (pgvector 1536), `usageEvents`→`usage_events`, `organizationProfileSuggestions`→`organization_profile_suggestions` (the "org memory" builder), `grantQuestions`→`questions`, `responseVersions`→`response_versions`, `grantMetrics`→`grant_metrics`, `grantMetricEvents`→`grant_metric_events`, `userSettings`→`user_settings`.

**Billing:** `billingService.checkLimit(userId, limitType, amount, organizationId)` with limit types `"projects" | "documents" | "ai_tokens"`; `recordUsage(...)` → `usage_events` powers metering; `subscriptions` holds plan state per org; Stripe in `server/services/stripeBilling.ts`. Route-level call sites to copy from: `routes.ts` ~871 (projects), ~1118 (documents), ~1556 (ai_tokens).

**File structure quick reference:**
```
/client/src/
  pages/            # dashboard, forms, drafts, upload, settings, organization,
                    # pricing, metrics, privacy, terms (some split into dirs)
  components/       # CitationTooltip, ClarificationPanel, EvidenceMap, UsageDashboard,
                    # ui/ (Radix + shadcn primitives)
  hooks/ lib/       # api client, export (docx/pdf), usage-tracking, signup-plan
/server/
  index.ts          # entry (port 5001 dev); wires Vite middleware
  routes.ts         # ALL API routes (~2,650 lines — navigate by grep, not scroll)
  storage.ts        # the data-access layer (83KB)
  services/         # ai.ts, retrieval.ts, embedding.ts, billing.ts,
                    # stripeBilling.ts, fileProcessor.ts, metrics.ts
  workers/          # documentProcessor.ts
  middleware/       # supabaseAuth.ts (requireSupabaseUser), cors.ts, rateLimiter.ts
  auth.ts           # Passport fallback (legacy — don't extend)
  db.ts             # Drizzle + Neon connection only
/api/server.ts      # Vercel serverless entry (NOT the RAG pipeline)
/shared/
  schema-simple.ts  # CANONICAL Drizzle schema
  schema.ts         # thin re-export for legacy imports — never define schema here
/test/fixtures/     # nonprofit/ (real .docx/.pdf), retrieval/, export/ (typed cases)
```

**Commands:**
```bash
npm run dev            # Express + Vite on :5001
npm run check          # tsc typecheck
npm run lint           # eslint client/src server api shared scripts
npm run db:push        # apply schema-simple.ts changes
npm run test           # vitest watch   |  test:run = CI mode  |  test:coverage
npm run test:auth      # auth smoke (needs dev server + SUPABASE_TEST_ACCESS_TOKEN)
npm run doc:process    # run document worker locally
npm run fixtures:nonprofit         # regenerate nonprofit fixtures
npm run auth:create-test-user      # create/reset Supabase test user (args: email password)
```

**Env vars:** `DATABASE_URL` (Postgres — Supabase pooler :6543 for serverless), `OPENAI_API_KEY` (server-only), `GRANTED_DEFAULT_MODEL`, `DOCUMENT_EMBEDDING_MODEL`, `SESSION_SECRET`, `STRIPE_*`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `DOCUMENT_WORKER_API_KEY` (guards `POST /api/workers/process-documents`), `CRON_SECRET` (guards the Vercel cron route), `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy names, exposed to client — anon key is the only safe one), `ANTHROPIC_API_KEY` (present, unused), `NOTION_TOKEN` / `NOTION_KB_PAGE_ID` (doc-keeper sync, optional).

**Tests:** vitest, colocated `*.test.ts(x)`. Server tests start with `// @vitest-environment node` and mock `storage` / `embedding` with `vi`. Typed fixture cases live in `test/fixtures/` (`grant-retrieval-cases.ts`, `grant-export-cases.ts`); real sample docs in `test/fixtures/nonprofit/`.

---

## Quality bar per deliverable

Adjectives don't count; these checklists do. Run every applicable item before calling work done, and report each result.

### Any change (baseline)
- [ ] On a branch, not `main`
- [ ] `npm run lint` — zero errors, zero new warnings
- [ ] `npm run check` — zero errors
- [ ] `npm run test:run` for affected files at minimum — green, output shown
- [ ] Diff contains no string matching `sk-`, `ntn_`, `secret_`, or `SUPABASE_SERVICE_ROLE`
- [ ] No stray files (scratch scripts, `.DS_Store`, editor artifacts) in the diff

### Backend route
- [ ] `requireSupabaseUser` in the chain (or a documented reason it's public + rate-limited)
- [ ] Org access verified before any read/write of org data
- [ ] Gated resource (project/document/LLM)? → `checkLimit` before, `recordUsage` after
- [ ] Input validated (zod or explicit checks); invalid input → 4xx with a message that says what to fix, never a 500
- [ ] Errors caught; response follows existing shape (`{ error }`, `mergeDevErrorDetails` in dev)
- [ ] No raw Drizzle — storage methods only
- [ ] A colocated `*.test.ts` covers: happy path, unauthorized (401/403), and the failure path you added

### Schema change
- [ ] Change is in `schema-simple.ts` only; applied via `npm run db:push`; no edits under `/migrations/` or in `schema.ts`
- [ ] New table has PK, `created_at`, `organizationId` FK; new FK/WHERE columns on large tables (`doc_chunks`, `usage_events`) have indexes
- [ ] Non-nullable new column has a default that backfills existing rows
- [ ] `storage.ts` methods updated, then callers; `npm run check` proves nothing was missed
- [ ] Schema table list in this file updated (or `/sync-docs` run)

### RAG pipeline change (ai.ts / retrieval.ts / embedding.ts / documentProcessor.ts)
- [ ] Citation path still goes through `normalizeGroundedCitations()`; entity check through `findUnsupportedSpecifics()`
- [ ] `ai.citations.test.ts` and `retrieval.test.ts` green; new behavior has a new test case
- [ ] Keyword-bypass and keyword-upgrade invariants intact (Mistake 12)
- [ ] Embedding/chunking changed? → re-index plan for `doc_chunks` + `embedding_cache` stated in the PR
- [ ] Plan check + `recordUsage` present on any new call path
- [ ] `/rag-eval` run, scorecard in the PR — no new fabrications vs. baseline

### Frontend change
- [ ] Server state via TanStack Query (existing query keys in `lib/`); no zustand, no new state library
- [ ] Styling via CSS vars / design tokens; `<Button variant>`; no raw hex or `bg-blue-*`
- [ ] Loading, empty, and error states all exist and render something intentional
- [ ] User-facing strings pass the copy rules (Mistake 16) — run `/copy-review` if more than a label changed
- [ ] Verified rendering in the running app (dev server on 5001), not just by reading the code

### User-facing copy
- [ ] No "AI-powered"; no boilerplate hype ("robust", "seamless", "empower")
- [ ] Errors: what happened + what to do next, in that order
- [ ] Empty states: name the next action
- [ ] Quantify where honest ("draft in ~10 minutes", "every claim cited")

### PR
- [ ] Title ≤ 60 chars, imperative, Linear ID prefix when applicable
- [ ] Body: What (bullets) / Why (1–2 sentences) / How to test (numbered, actually followable)
- [ ] Diff self-reviewed end-to-end before opening — no debugging leftovers, no unrelated reformatting
- [ ] All baseline checks green **in this session**, results stated in the PR body

### Docs update
- [ ] Every claim verified against code before writing (open the file, don't trust the old doc)
- [ ] Fixed in place — no "NOTE: this changed" appended above stale text
- [ ] Point-in-time snapshots moved to `docs/archive/` with a row in its README

---

## When uncertain — exact escalation rules

**Proceed without asking when ALL of these hold:** the task came from the user or a Linear issue; the change is on a branch; it's reversible; it doesn't touch the "ask first" list below. Finishing the job beats asking permission for each step.

**Stop and ask before:**
1. Deleting or migrating data (any `DELETE`/`DROP`/destructive `db:push` against a shared DB), or running destructive SQL of any kind.
2. Changing plan limits, pricing, Stripe products, or any billing math.
3. Changing the generation prompt/instructions in `ai.ts` beyond what the task explicitly requires — the prompt encodes the product's grounding contract.
4. Adding a dependency (`npm install`) or a new external service.
5. Changing auth flows (`supabaseAuth.ts`, session handling, signup/checkout) beyond the scoped issue.
6. Adopting Anthropic/OpenRouter/multi-provider anything (settled decision — `docs/DECISIONS.md`; reopen only on its listed revisit triggers).
7. Anything on `main`: if you're on `main` with changes, stop immediately.
8. Merging when Codex hasn't given a clean pass, or after 5 review rounds (5 rounds = design problem → human call).
9. First Notion publish of a session (outward-facing write).
10. Rewriting git history or force-pushing anything.

**Resolution order when sources conflict:** code > this file > `docs/DECISIONS.md` > other docs (`PRD.md`, roadmap = intent only). If code contradicts this file, follow the code and fix this file in the same session.

**When you can't find something:** grep at least three ways (symbol name, route path, SQL table name) before concluding it doesn't exist. If a doc says it exists and you can't find it, that's doc drift — record it in "Reality vs. the docs" below.

**When you're stuck:** two failed attempts at the same fix = stop guessing. Write down observed vs. expected, form a hypothesis, and test the hypothesis directly (log, isolate, reproduce) — or report the blocker with what you've established. Never keep mutating code hoping something works.

**When a never-break rule conflicts with the requested task:** stop and say so. The rules win until the user explicitly overrides in writing.

**Model assignment for dev tasks** (Claude tier, not the app's runtime LLM): architecture / RAG pipeline / new systems → Opus; backend routes, services, billing → Sonnet; mechanical UI fixes and copy → Sonnet or Haiku. **Never Haiku** for the generation pipeline, billing/plan logic, or auth.

---

## Reality vs. the docs (known drift — keep current)

- **No `api/simple.ts`.** RAG lives in `server/services/`; `api/` holds only the Vercel entry `server.ts`.
- **OpenAI-only in practice.** "Multi-provider" language in the PRD is aspirational; `@anthropic-ai/sdk` installed, unwired — deliberately (DECISIONS.md 2026-06-30).
- **No OCR.** Text PDFs (`unpdf`) and DOCX (`mammoth`) only.
- **`zustand` installed, unused.** Don't start.
- **`shared/schema.ts` is a thin re-export of `schema-simple.ts`, not dead code.** Server files legitimately import types from it. What's forbidden is defining tables/columns there. (Corrected 2026-07-06 — older docs and `.claude/agents/schema-guardian.md` said "nothing imports it," which is wrong.)
- **Data access is `server/storage.ts`** (top-level), not `server/services/storage.ts`.
- **The DB driver is `postgres-js`, not Neon serverless.** `@neondatabase/serverless` is in `package.json` but imported nowhere; `server/db.ts` uses `postgres` with Supabase-pooler-tuned settings. Older docs saying "Neon" are stale. (Found 2026-07-06.)
- **No `drafts` table** (→ `response_versions`), **no `clarifications` table** (Phase 4).
- `PROJECT_ROADMAP.md` phase statuses are directionally right; its checkboxes are not verified — use `/phase-check`.

If you find new drift, fix the doc or add it here — don't let it compound.

---

## Slash commands quick reference

| Command | When | What happens |
|---|---|---|
| `/start` | Before touching any code | Pulls main, creates + pushes a correctly named branch |
| `/new-feature` | Before writing feature code | End-to-end plan: files, schema, billing gate, tests — confirmed before implementation |
| `/rag-eval` | After any pipeline/prompt change; before model changes | Citation-faithfulness scorecard over the nonprofit fixtures — catches fabrication regressions |
| `/smoke` | Before `/pr` on anything touching the golden path; after merges | Scripted API pass: auth → project → upload → process → generate → verify citations |
| `/pipeline-doctor` | "Doc stuck processing" / "draft has no citations" | Diagnoses the ingestion pipeline stage by stage, names the broken stage + the fix |
| `/pr` | Work done on a branch | Lint + tsc + secret scan, drafts description, `gh pr create` |
| `/review` | PR exists | Codex loop: trigger → fix P1/P2 → re-trigger → clean → auto-merge (squash) |
| `/sync-docs` | After any structural change | doc-keeper reconciles CLAUDE.md, agents, README, reference docs, Notion |
| `/phase-check` | Session start / before planning | Audits roadmap against actual code |
| `/copy-review` | Before shipping user-facing text | Brand-voice audit + fixes |

The harness loads automatically on session start. Specialist agents in `.claude/agents/`: `rag-engineer`, `schema-guardian`, `brand-voice`, `doc-keeper`, `pr-reviewer`.
