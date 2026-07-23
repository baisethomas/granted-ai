# Granted AI — Claude Harness

## What this app is

Granted is a grant writing assistant. Users upload their org's documents (mission statements, past proposals, budgets), add grant questions to a project, and the system generates grounded, cited answers — one question at a time — with assumption tags where a claim can't be sourced.

Target users: solo nonprofit founders, grant professionals, program directors. The value is **speed + trust** — a credible draft fast, every claim traceable to an uploaded source. The audience is skeptical of AI hallucination, so grounding and honesty about assumptions are the product, not a feature.

Currently in **Phase 3 (RAG Core)** of a 6-phase build. Phases 1–2 (Auth, Document Ingestion) are complete. Phase 4 (Clarification engine, Evidence Map UI) is next and **not yet built**.

---

## ⚠️ Reality vs. the docs (read this first)

This repo has ~20 markdown planning docs (`PRD.md`, `PROJECT_ROADMAP.md`, `*_PLAN.md`, `REFACTORING_*.md`). **Treat them as intent, not truth.** The code is the source of truth. Known drift as of this harness pass:

- **There is no `api/simple.ts`.** Older docs point the RAG pipeline there. It was refactored into `server/services/`. `api/` contains only `server.ts` (the Vercel serverless entry).
- **"Model-agnostic / multi-provider (OpenAI + Anthropic)" is aspirational.** In practice the app is **OpenAI-only**. The `@anthropic-ai/sdk` dependency exists but is not wired into generation.
- **OCR is not implemented.** The PRD promises OCR for scanned docs; no OCR library is installed. PDF text extraction (`unpdf`) handles text-based PDFs only.
- **`zustand` is installed but unused.** Client state is TanStack Query (server state) + React hooks (local). Don't reach for zustand.
- **`shared/schema.ts` is legacy/dead.** The canonical Drizzle schema is `shared/schema-simple.ts` (confirmed in `drizzle.config.ts`). Don't edit `schema.ts`.
- **The data-access layer is `server/storage.ts`, not `server/services/storage.ts`.** It lives at the top level of `server/`, alongside `routes.ts` and `db.ts` — not inside `services/`. `server/services/` only holds `ai.ts`, `retrieval.ts`, `embedding.ts`, `fileProcessor.ts`, `billing.ts`, `stripeBilling.ts`, `metrics.ts`. This wrong path had propagated into `.claude/agents/rag-engineer.md`, `schema-guardian.md`, and `pr-reviewer.md` — fixed in this pass.
- **`README.md` still says the generation model is `GPT-4`** (Tech Stack list, and a whole "Why GPT-4 Instead of GPT-4 Turbo or GPT-3.5?" rationale section). The actual default is `gpt-4o-mini` via `GRANTED_DEFAULT_MODEL` (some paths hardcode `gpt-4o`) — see Architecture above. Not fixed yet — out of scope for the pass that found it. README also carries extensive performance/cost benchmark tables (query latency at scale, cost-per-response, beta-tester satisfaction percentages) with no source in the codebase; treat those as unverified, not measured fact, until someone traces where the numbers came from.

- **`setup-database.sql` (repo root) does not reflect the live DB.** It enables RLS on only 6 tables and was **never applied** — the real schema came from `db:push`, and RLS is now enforced on all 19 tables via `supabase/migrations/0005_enable_rls_public_tables.sql`. Don't treat `setup-database.sql` as the source of truth for DB security; see the "Database security baseline" under Architecture.

If you find new drift, fix the doc or note it here — don't let it compound.

---

## Model Assignments (for Claude sessions — not the app's runtime LLM)

This is which **Claude tier** to use for dev tasks. Distinct from the app's runtime model (OpenAI, see below).

| Task | Model | Why |
|---|---|---|
| Architecture, new systems, RAG pipeline changes | Opus | Complex reasoning |
| Backend routes, services, workers, billing | Sonnet | Core logic |
| UI components, form wiring, small fixes, copy | Sonnet/Haiku | Mechanical → Haiku; user-facing → Sonnet |
| Reading/reconciling PRD & roadmap | Sonnet | Needs document context |

Never use Haiku for the generation pipeline, billing/plan logic, or auth.

---

## Rules — Never Break These

- **Never fabricate citations.** Every grounded claim maps to a real `doc_chunks` row via `draft_citations`. If a fact can't be sourced, it becomes an `assumption_labels` entry — never invent a source. The `normalizeGroundedCitations()` helper in `server/services/ai.ts` enforces the citation shape; use it.
- **Never call an LLM without a plan check first.** Gate every token-spending path with `billingService.checkLimit(userId, "ai_tokens", estimatedTokens, organizationId)` before calling `aiService`. Same pattern for `"projects"` and `"documents"` limits on those routes.
- **Never expose provider keys client-side.** `OPENAI_API_KEY` is server-only. The only key that reaches the browser is the Supabase anon key.
- **Never use `Promise.all` for multi-source retrieval or fan-out** — use `Promise.allSettled` so one failure doesn't kill the response.
- **Never write Drizzle migrations by hand.** Edit `shared/schema-simple.ts`, then `npm run db:push`. `db:push` is the live mechanism; the `/migrations/` directory is stale history — its `meta/` snapshot only covers migration 0000 (while 0001–0008 exist), so `drizzle-kit generate` prompts on phantom renames. Don't use `generate` here. **`supabase/migrations/` is a separate, hand-written SQL directory that Drizzle does not manage** — it holds things `db:push` can't express (RLS enablement, pgvector setup, policies). The RLS security fix lives there (`0005_enable_rls_public_tables.sql`); future RLS/policy work goes there too and is applied via the Supabase CLI/dashboard, not `db:push`.
- **Never bypass tenant isolation.** Every query on user data filters by `organizationId`. Data access goes through `server/storage.ts`, not raw Drizzle in routes.
- **Never expose the Supabase Data API, and enable RLS on every new public table.** The app never uses PostgREST — it talks to Postgres directly via `DATABASE_URL` as the table-owner `postgres` role (which bypasses RLS). Two locks keep the browser-shipped anon key from reading the DB: (1) the Supabase **Data API is disabled** in the dashboard (PostgREST returns 503 PGRST002) — keep it OFF; (2) **RLS is enabled on all 19 public tables with no policies** (`supabase/migrations/0005_enable_rls_public_tables.sql`), so PostgREST roles are denied everything. `db:push` does **not** manage RLS, so any table you add via `shared/schema-simple.ts` lands with RLS OFF — you must enable it explicitly (add an `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to a new hand-written file in `supabase/migrations/` and apply it). This matters most if anyone ever re-enables the Data API. See the security baseline under Architecture. This closed a real cross-tenant leak (PR #49) where the anon key could read every row in every table.
- **Run the relevant tests before committing.** Tests are colocated (`*.test.ts`) and run with `vitest`. After auth changes run `npm run test:auth`; after billing changes run the billing tests; run `npm run check` (tsc) for type safety.
- **Never commit or push directly to `main`.** Every change — no matter how small — starts on a new branch created *before* touching any code. Branch naming: `feat/GRA-<id>-short-description`, `fix/GRA-<id>-short-description`, or `chore/short-description`. When work is done, open a PR with `gh pr create` (use `/pr`). Code is not shipped until a PR exists. If you find yourself on `main` with uncommitted changes, stop and ask before proceeding.
- **Never merge an unreviewed PR.** The only path into `main` is `/review`: it triggers **Codex** (`chatgpt-codex-connector`) — an independent external reviewer, GPT not Claude — which posts P1/P2/P3 findings on the PR. You fix every P1/P2, re-trigger, and repeat until Codex is clean, which auto-merges (squash). A clean Codex pass is the *only* thing that clears the gate. Never merge by hand to skip Codex, and never bypass a P1/P2. (The local `pr-reviewer` Claude agent is an optional *free pre-pass* to catch obvious issues before spending Codex rounds — it is **not** the gate, because it's Claude reviewing Claude.)
- **After any structural change, run `/sync-docs`** (the doc-keeper agent) to reconcile this file, the README, reference docs, and the Notion knowledgebase with the new reality. "Structural" = new/renamed/deleted files or services, schema changes, new/changed endpoints, new env vars, or a completed feature/phase. Do not let docs drift from code — that drift is what this harness pass had to clean up.

---

## Architecture (as actually built)

**Stack:** Vite + React 18 (frontend) · Express + Node/TypeScript, run via `tsx server/index.ts` (backend, **not** a separate Vite dev server — Express serves Vite in middleware mode, see `server/vite.ts`) · PostgreSQL (Neon serverless) via Drizzle ORM · Supabase Auth + Storage · pgvector embeddings · Stripe billing.

**Dev server runs on port 5001** locally (5000 avoided — macOS AirPlay). Entry: `server/index.ts`.

**Logged-out surface (GRA-68):** `/` is the marketing landing page. "Early access" now means **open signup** — the GRA-67 waitlist (email-capture form, `POST /api/early-access`, `early_access_signups` table) was removed in GRA-68. The hero and CTA "Get early access" buttons call `getAuthUrl("starter")` (`client/src/lib/domains.ts`) → `/auth?plan=starter`, which opens the account-creation form directly (a `plan` query param is what switches `/auth` into signup mode — plain `/auth` is the sign-in form, so signup CTAs must carry a plan). The FAQ's early-access entry says you can sign up and start drafting today. On `pricing.tsx`, logged-out Starter/Pro CTAs are back to `getAuthUrl(plan)` with "Start Free"/"Try Pro" labels; the Team plan's CTA is "Get notified" (a `mailto:sales@granted.ai` link). **`/auth` is fully open and actively advertised.**

**Client navigation:** `wouter`-based real routing (`client/src/App.tsx`) — not React state. Sidebar is 5 items: Dashboard, Organization, Documents, Metrics, Settings.
```
/app                              Dashboard (home)
/app/documents                    Upload page, nav-labeled "Documents"
/app/metrics                      Portfolio metrics
/app/settings                     Settings
/app/organization                 Organization profile
/app/applications/:id/:tab?       Application workspace — tab: overview (default) | questions | drafts | metrics
```
`Sidebar` / `MobileBottomNav` / `MainHeader` still take an `activeTab`/`onTabChange` tab-id prop pair for simplicity; `App.tsx` derives `activeTab` from the URL and translates `onTabChange` into `setLocation` — those components don't know routing exists. `projects/[id].tsx` reads its own `:id`/`:tab` via wouter's `useParams()` (not a `projectId` prop) and renders `QuestionsPanel`/`DraftsPanel` as its Questions/Drafts tabs, above which sits a stage-progress header (Set up → Questions → Drafts → Review → Export) computed from real question/answer counts. The in-page "Back" button on an application returns to wherever it was opened from (tracked via a ref, not raw browser history) since in-app tab clicks also push history entries for the native back button to step through.

There is no first-run tour modal anymore (the old `onboarding-dialog.tsx` 5-step modal was deleted in GRA-59). Instead `HomeGuidance` (`client/src/components/HomeGuidance.tsx`) renders at the top of Dashboard: a "Get set up" checklist (upload documents → add questions → generate a first draft) while incomplete, then a priority-ordered "Up next" card once it's done, plus an independent "Continue {title}" row sourced from a `lastOpenedProjectId` written to `localStorage` on every project open (`client/src/lib/recent-project.ts`). The checklist/up-next logic itself is pure and colocated in `client/src/lib/home-guidance.ts` (`isDraftProject`, `computeChecklistProgress`, `computeUpNext`) — projects with a non-`"draft"` status (submitted/awarded/declined/final) are never nudged. `dashboard.tsx` withholds `HomeGuidance` entirely until the documents and per-project question queries it depends on have settled (`isLoading` or `isError`), so it never flashes a wrong state.

**Request → data flow:**
```
client (/api/* via TanStack Query)
  → Express route in server/routes.ts   (~2,650 lines; guarded by requireSupabaseUser)
    → billingService.checkLimit(...)     (plan enforcement, server/services/billing.ts)
    → server/storage.ts                  (the real data-access layer over Drizzle — 83KB)
    → server/services/ai.ts              (AIService: retrieval → generation → citations)
```

**Auth:** Supabase is primary. The request guard is `requireSupabaseUser` from `server/middleware/supabaseAuth.ts` — every protected route uses it. `server/auth.ts` + Passport local is a secondary fallback; don't add new Passport strategies. The Passport-local routes (`/api/auth/signup|login|logout|me`, wired via `setupAuth(app)` in `server/index.ts`) read/write the `public.users.password` column (scrypt `hash:salt`). They are **HTTP-reachable but UI-unreachable** — the client uses Supabase Auth exclusively (`client/src/lib/supabase.ts`) and no user has a password set. Removing them is a flagged follow-up, not yet done.

**Database security baseline (post-PR #49):** The app reaches Postgres only through Drizzle over `DATABASE_URL` as the table-owner `postgres` role — it never uses Supabase's PostgREST Data API. That auto-exposed data path is closed by two independent locks:
1. **Data API disabled** in the Supabase dashboard (Settings → Data API toggle OFF). PostgREST returns 503 PGRST002 to the anon key. This is the outer lock.
2. **RLS enabled on all 19 public tables, no policies** (`supabase/migrations/0005_enable_rls_public_tables.sql`) — defense-in-depth. `postgres`-role Drizzle queries bypass RLS, so the app is unaffected; PostgREST's anon/authenticated roles are denied everything.

Before the fix, RLS was OFF on every table (Drizzle `db:push` never enables it) *and* the Data API was on, so the browser-shipped `NEXT_PUBLIC_SUPABASE_ANON_KEY` could read every row of every table (all users incl. email/EIN, all documents/projects/subscriptions) with zero tenant filtering — bypassing Express / `requireSupabaseUser` / `organizationId` isolation entirely. Supabase's Security Advisor now reports 0 errors (was 20 CRITICAL); the 19 "RLS enabled, no policy" INFO notices are expected and benign given no PostgREST usage. Note `setup-database.sql` at the repo root enables RLS on only 6 tables and was **never applied** — the live schema came from `db:push`, not that file.

**The RAG pipeline lives in `server/services/`:**
- `ai.ts` — `AIService` class (exported as `aiService` singleton). Generation, grounding, `normalizeGroundedCitations()`, metric suggestions. ~790 lines.
- `retrieval.ts` — `retrieveRelevantChunks()`. Genuinely **hybrid**: semantic (pgvector cosine) + keyword, with a similarity floor for semantic-only hits. Delegates to `storage.searchDocChunksBySimilarity` / `searchDocChunksByKeyword`.
- `embedding.ts` — `generateEmbedding()`. OpenAI `text-embedding-3-small`, 1536 dims. Degrades gracefully (returns null) if no key.

**Runtime LLM config (OpenAI):**
- Generation model: `GRANTED_DEFAULT_MODEL` env, default `gpt-4o-mini`. Some paths hardcode `gpt-4o`.
- Embedding model: `DOCUMENT_EMBEDDING_MODEL` env, default `text-embedding-3-small`.

**The core generate flow is per-QUESTION, not per-project:**
```
Create project → add questions (grant_questions, table "questions")
  → POST /api/questions/:id/generate
    → plan check (ai_tokens) → retrieve chunks → generate grounded answer
      → persist a response_versions row (versioning) + draft_citations + assumption_labels
Retry:            POST /api/questions/:id/retry
Manual edit:      PUT  /api/questions/:id/response
Version history:  GET  /api/questions/:questionId/versions
                  POST /api/questions/:questionId/versions/:versionId/current
```

**Async document processing (not in the request cycle):**
- Worker: `server/workers/documentProcessor.ts` — extract → chunk → embed.
- Triggered by `POST /api/workers/process-documents` and cron `GET /api/cron/process-documents` (Vercel cron).
- Job state tracked in `document_processing_jobs`; extracted text in `document_extractions`; chunks + vectors in `doc_chunks`; embedding results cached in `embedding_cache`.

---

## Data model (canonical: `shared/schema-simple.ts`)

Real tables (Drizzle export → SQL name):
`users`, `organizations`, `memberships`, `subscriptions`, `projects`, `documents`, `documentExtractions`→`document_extractions`, `docChunks`→`doc_chunks` (pgvector 1536), `documentProcessingJobs`→`document_processing_jobs`, `draftCitations`→`draft_citations`, `assumptionLabels`→`assumption_labels`, `embeddingCache`→`embedding_cache` (pgvector 1536), `usageEvents`→`usage_events`, `organizationProfileSuggestions`→`organization_profile_suggestions` (the "org memory" builder), `grantQuestions`→`questions`, `responseVersions`→`response_versions` (**this is where generated answers + versions live — there is no `drafts` table**), `grantMetrics`→`grant_metrics`, `grantMetricEvents`→`grant_metric_events`, `userSettings`→`user_settings`.

`memberships` has a unique index `memberships_user_org_unique` on (`userId`, `organizationId`) — added in GRA-61 to back the race-safe `onConflictDoNothing()` inserts in `DbStorage.ensureDefaultOrganizationForUser` (`server/storage.ts`), which previously 500'd with duplicate-key errors when a new user's first page load fired concurrent API calls.

There is **no `clarifications` table yet** — the clarification engine is Phase 4.

pgvector columns require the `vector` extension (`enable_vector.sql`).

---

## Billing / plan enforcement (Stripe)

- `server/services/billing.ts` — `billingService.checkLimit(userId, limitType, amount, organizationId)` and `checkUsageAgainstLimit(...)`. Limit types in use: `"projects"`, `"documents"`, `"ai_tokens"`.
- `server/services/stripeBilling.ts` — Stripe integration (checkout, webhooks, subscription state).
- `usage_events` powers metering; `subscriptions` holds plan state per org.
- Every route that spends tokens or creates gated resources calls `checkLimit` **before** doing the work (see `routes.ts` lines ~870, 906, 1117, 1555 for the pattern).

---

## Design System

Full reference: `docs/design-system.md`. Key rules:
- Primary brand color `#2186EB` — use `text-primary` / `bg-primary` (CSS vars), never raw `bg-blue-600`.
- Fonts: Open Sans (UI), JetBrains Mono (code/hints).
- Buttons: always `<Button variant="...">` from `client/src/components/ui/button.tsx`.
- Radix UI primitives + shadcn pattern in `client/src/components/ui/`.

## Brand Voice

See `.claude/agents/brand-voice.md`. In short: confident, clear, efficient; lead with what the user gets; never say "AI-powered"; error messages state what happened + what to do next; empty states invite action. Audience is skeptical grant professionals — no clichés, no overselling.

---

## Development Commands

```bash
npm run dev            # Express + Vite (middleware mode) on port 5001
npm run build          # vite build + esbuild server bundle
npm run start          # production
npm run check          # tsc typecheck
npm run lint           # eslint client/src server api shared scripts
npm run db:push        # apply schema-simple.ts changes (Drizzle)
npm run test           # vitest (watch)
npm run test:run       # vitest run (CI)
npm run test:auth      # auth smoke tests
npm run doc:process    # run the document worker locally
npm run fixtures:nonprofit        # seed nonprofit test fixtures
npm run auth:create-test-user     # create a Supabase test user
npm run marketing:image           # generate a marketing image via OpenAI gpt-image-1
                                  #   (scripts/generate-marketing-image.ts; --prompt required,
                                  #   optional --size / --out; writes to marketing/assets/, gitignored)
```

## Environment Variables

Loaded locally by `server/env.ts` (dotenv, `.env.local` then `.env`) — a side-effect module that must stay the first import of `server/index.ts` (see File Structure). On Vercel the platform injects env before module evaluation, so this only matters for local dev.

| Key | Where | Notes |
|---|---|---|
| `DATABASE_URL` | server | Neon PostgreSQL. Note: `drizzle.config.ts` loads only `.env` (not `.env.local`), so keep `DATABASE_URL` in `.env` for `db:push` to see it |
| `OPENAI_API_KEY` | server | Generation + embeddings. Never client-side |
| `GRANTED_DEFAULT_MODEL` | server | Generation model, default `gpt-4o-mini` |
| `DOCUMENT_EMBEDDING_MODEL` | server | Default `text-embedding-3-small` |
| `GRANTED_IMAGE_MODEL` | server (scripts) | Optional; image model for `npm run marketing:image`, default `gpt-image-1` |
| `SESSION_SECRET` | server | Express sessions |
| `STRIPE_*` | server | Stripe billing keys/webhook secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Vite define | Legacy name; exposed to client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vite define | Safe — anon key only |
| `ANTHROPIC_API_KEY` | server | Present in env story but **not used** by current pipeline |

## File Structure Quick Reference

```
/client/src/
  pages/          # dashboard, upload (nav label "Documents"), settings (three tabs —
                  # Drafting / General / Plan & billing — auto-saves on a 700ms debounce,
                  # no Save/Reset buttons; the AI model picker was removed from the UI
                  # though aiModel/fallbackModel remain in state + payload),
                  # organization, pricing, metrics, privacy, terms; projects/[id].tsx is the per-application
                  # workspace — Overview/Metrics/Questions/Drafts tabs, the latter two backed by
                  # projects/QuestionsPanel.tsx and projects/DraftsPanel.tsx (forms.tsx and
                  # drafts.tsx were merged into these as tabs in GRA-57 — no longer standalone pages)
  components/     # custom, top-level (not components/ui/): ClarificationPanel, EvidenceMap,
                  # HomeGuidance (Home's setup checklist + "up next" card, GRA-59)
  components/landing/  # marketing landing sections (hero, CTA, FAQ, footer, ...) —
                  # "Get early access" CTAs go to /auth?plan=starter (open signup, GRA-68)
  components/settings/  # Settings page pieces (GRA-63): rows.tsx (SettingsRow /
                  # SettingsRowStacked / SettingsSection layout primitives) and
                  # PlanBilling.tsx (Plan & billing tab — plan status, Pro checkout,
                  # Stripe billing portal, usage meters). UsageDashboard.tsx and
                  # lib/usage-tracking.ts were deleted in this rework
  components/ui/  # Radix + shadcn primitives
  hooks/  lib/    # API client, export (docx/pdf), questions.ts (response-status
                  # helpers), home-guidance.ts + recent-project.ts (Home guidance logic and the
                  # "continue where you left off" localStorage key, GRA-59),
                  # workspace-query-keys.ts (per-workspace TanStack Query keys, incl. billingUsage)

/server/
  env.ts          # side-effect module: loads .env.local/.env via dotenv (GRA-61).
                  # MUST stay the FIRST import in index.ts — the repo is ESM, imports
                  # are hoisted, so modules imported before it (e.g. storage.ts, which
                  # reads DATABASE_URL at module scope) would see an empty env. That's
                  # how local dev silently fell back to in-memory MemStorage pre-fix
  index.ts        # entry (port 5001 dev); wires Vite middleware
  routes.ts       # ALL API routes (~2,650 lines — navigate by section)
  storage.ts      # the real data-access layer over Drizzle (83KB)
  services/       # ai.ts (RAG), retrieval.ts, embedding.ts,
                  # billing.ts, stripeBilling.ts, fileProcessor.ts, metrics.ts
  workers/        # documentProcessor.ts (extract → chunk → embed)
  middleware/     # supabaseAuth.ts (requireSupabaseUser), cors.ts, rateLimiter.ts
  auth.ts         # Passport fallback (secondary)
  db.ts           # Drizzle + Neon connection only

/api/server.ts    # Vercel serverless entry (NOT the RAG pipeline)
/shared/
  schema-simple.ts  # CANONICAL Drizzle schema
  schema.ts         # legacy/dead — do not edit
```

---

## Slash Commands Quick Reference

| Command | When to use | What happens |
|---|---|---|
| `/start` | **Before touching any code** for a Linear issue | Pulls latest main, creates a correctly-named branch (`feat/`, `fix/`, `chore/`), pushes to remote — enforces branch-first workflow |
| `/sync-docs` | After any structural change (new file, renamed service, schema change, new endpoint, new env var, completed phase) | doc-keeper reconciles `CLAUDE.md`, agent files, `README`, reference docs, and publishes a Notion update |
| `/phase-check` | When starting a session or before planning new work | Audits `PROJECT_ROADMAP.md` against actual code; flags completed items and anything marked in-progress that isn't |
| `/pr` | When work on a branch is done | Runs lint + tsc, scans for secrets, drafts PR description, then calls `gh pr create` — returns the PR URL |
| `/review` | After a PR exists | Triggers **Codex** (external, GPT) on the PR, you fix its P1/P2 findings, re-trigger until clean, then auto-merge (squash). The only path into `main`. Greptile is a disabled second gate (out of credits) |
| `/new-feature` | Before writing any new feature code | End-to-end plan: touches which files, schema changes needed, billing gate, tests required. Must be confirmed before implementation starts |
| `/copy-review` | Before shipping any user-facing text | Checks wording against brand voice — no "AI-powered", errors have what-happened + what-to-do-next, empty states invite action |
| `/campaign` | When planning/building a marketing campaign | Runs the marketing agent team: **campaign-strategist** writes a brief (goal, audience, angle, calendar; commissions **market-researcher** intel briefs → `marketing/research/` when the landscape is unclear) → you approve → it delegates to **social-media-manager**, **content-generator** (long-form: blog/guides/case studies/landing copy), **ad-copywriter**, and **visual-producer** (`npm run marketing:image`) → **brand-voice** checks the copy → package lands in `marketing/campaigns/<slug>/` (images in `marketing/assets/`, gitignored) |

The harness loads automatically on session start — you never need to activate it. These commands are for deliberate mid-session actions.
