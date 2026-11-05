# Security Page — Implementation Plan

Status: **Not started.** Needs a Linear issue — paste-ready issue body in [Tracking](#tracking) below.

## Problem

Granted's logged-out surface has no security page. A prospective buyer — a solo nonprofit founder, a grant professional, or the IT reviewer a program officer forwards us to — has nowhere to read how their documents are handled. The only security-adjacent public copy today is one trust card ("Private by default", `client/src/components/landing/trust-section.tsx:6–10`), one FAQ line about documents not being used for public model training (`faq-section.tsx:10–12`), and a generic "reasonable technical and organizational measures" paragraph in the privacy policy (`privacy.tsx:83–88`).

That is a real gap for this audience specifically. Grant professionals are skeptical of AI hallucination by default — the product's whole premise is that every claim traces to a source they uploaded. We have a genuinely strong story there and currently no page that tells it.

The product is launched, so this page is a statement of current posture, not a preview. It should read finished: no "coming soon", no roadmap section, no hedging that implies an unfinished product.

## The core constraint: every claim must be verifiable in code

This is the part that matters most, and the reason this doc leads with an audit rather than a page layout.

**Do not write this page from `README.md`.** The README's "Security & Compliance" section (lines 624–682) claims AES-256 encryption at rest, column-level encryption for embeddings, and row-level security as enforced runtime protection. None of those are implemented in application code. Writing marketing copy from that section ships false security claims to the exact audience most likely to verify them.

There is also live drift in the opposite direction: `client/src/pages/privacy.tsx:69` tells the public that content may be processed by "OpenAI and Anthropic". The app is OpenAI-only — `@anthropic-ai/sdk` is installed but never wired into generation. Any subprocessor list on the security page will contradict the privacy policy until one of them is fixed.

The four buckets below are the audit output. They are reusable beyond this page — for security questionnaires, procurement reviews, and an eventual SOC 2 effort.

### Bucket 1 — Safe to claim (provable in code)

| Claim | Evidence |
|---|---|
| Every API request authenticated by a server-verified Supabase JWT | `server/middleware/supabaseAuth.ts` — `requireSupabaseUser` calls `supabaseAdminClient.auth.getUser(token)` |
| Tokens accepted only from the `Authorization` header, never from a URL | `supabaseAuth.ts:29–40` (the `?access_token=` fallback was deliberately removed — tokens in URLs leak via logs, history, and `Referer`) |
| Data scoped per organization on access paths | `userHasOrganizationAccess`, `server/storage.ts:1472`; vector search filters `d.organization_id = $1` at `storage.ts:2001` |
| Cross-tenant IDs return 404, not 403 — no existence leak | `assertQuestionAccess`, `server/routes.ts:71–93` |
| Uploaded files reachable only via time-limited signed URLs (1 hour) | `routes.ts:1071–1075`; no `getPublicUrl` anywhere in the repo |
| Provider keys never reach the browser | `vite.config.ts:41–45` exposes only the Supabase URL, the anon key, and the app domain |
| Rate limits on API, auth, and upload endpoints | `server/middleware/rateLimiter.ts` — 100/15min API, 5/15min auth, 10/hour upload |
| Security headers including HSTS and `frame-ancestors 'none'` in production | `server/securityHeaders.ts:8–34` |
| Card data never touches our servers | `server/services/stripeBilling.ts:58–73` (Stripe Checkout); webhook signatures verified at `:131–143` |
| Upload type allowlist (PDF/TXT/DOC/DOCX) and 10 MB cap | `routes.ts:405–431` |
| Deleting a document or project hard-deletes its chunks and embeddings | `onDelete: "cascade"` in `shared/schema-simple.ts:114–124`; explicit cascade transaction at `storage.ts:1579–1617` |
| Citations are verified against retrieved source text; unverifiable ones are dropped | `normalizeGroundedCitations`, `server/services/ai.ts:96–148`; `findUnsupportedSpecifics` at `:265–304` |

The last row is the strongest asset on the page. "We drop citations the model can't prove against your documents" is specific, true, verifiable, and differentiated — a better hook for a skeptical reader than any infrastructure bullet. It should lead.

### Bucket 2 — Needs qualification

- **Encryption at rest** — inherited from Neon and Supabase defaults, not implemented by us. Write "hosted on infrastructure that encrypts data at rest", never "we encrypt your data with AES-256".
- **"We don't train on your data"** — the privacy policy already promises this, but nothing in code enforces it (no `store: false`, no zero-retention flag on OpenAI calls). It rests on OpenAI's API terms. Frame as a contractual commitment, not a technical control, and confirm the account tier first.
- **Role-based access** — `memberships.role` is stored but never checked for authorization. Do not claim RBAC.
- **Row-level security** — `supabase/migrations/0005_enable_rls_public_tables.sql` exists, but the app connects as table owner and bypasses it. It protects the PostgREST path only. Do not present it as the primary isolation mechanism; app-layer organization scoping is.
- **Session security** — httpOnly/sameSite cookies apply only to the legacy Passport fallback (`server/auth.ts:90–102`). Primary sessions are JWTs in `localStorage`, and `client/src/lib/supabase.ts:18–27` documents the XSS exposure honestly. Do not claim httpOnly session cookies.
- **Account deletion** — the privacy policy promises deletion "at any time" (`privacy.tsx:79–80`), but there is no self-service account-deletion endpoint. Document the real process (email request) rather than implying a button exists.

### Bucket 3 — Must not appear on the page

SOC 2, ISO 27001 (no audit — `README.md:1064` says so), HIPAA (`README.md:664` disclaims it), MFA/2FA (not implemented), penetration testing (`README.md:684` — none yet), virus scanning on uploads, field-level encryption or customer-managed keys, audit logging of data access, per-organization storage buckets, Anthropic as a processor.

Because there is no roadmap section, the residual risk is that confident page-level phrasing *implies* certification coverage we don't have. Mitigation: avoid umbrella words that read as audited status — "enterprise-grade", "bank-level", "fully compliant", "certified". Describe the specific mechanism instead. Specificity is what earns trust with this audience anyway, and it happens to be the honest option.

### Bucket 4 — Verify outside the repo before publishing

These gate the subprocessor table and any residency statement:

1. Supabase Storage bucket is actually private, and whether the PostgREST Data API is disabled.
2. Whether migration `0005_enable_rls_public_tables.sql` is applied in production.
3. Neon and Supabase encryption-at-rest specifics and data residency region.
4. The OpenAI account's data-retention tier and training opt-out status.
5. Which vendor DPAs are executed (Supabase, Neon, OpenAI, Stripe, Vercel).

## Page content outline

Marketing-style sections, so it should read like `pricing.tsx` rather than the legal prose of `privacy.tsx`. Written for someone skimming for a reason to say no.

1. **Hero** — eyebrow "Security", headline on the theme that every claim traces to a document you uploaded, and your documents stay inside your organization. One paragraph, no competing CTA buttons.
2. **Grounding and citations** — lead with the differentiator: answers cite retrieved source text, citations the model can't prove against your documents are dropped, and unsourced claims are labeled as assumptions instead of presented as fact.
3. **How your documents are handled** — upload → private per-organization storage → text extraction → chunk and embed → retrieval at draft time. Turns the architecture into a trust story and is entirely factual.
4. **Access and isolation** — server-verified auth on every request, organization-scoped queries, signed time-limited file access, unknown-tenant IDs indistinguishable from missing ones.
5. **Infrastructure and subprocessors** — table of vendor / what it receives / why: Supabase (auth, file storage), Neon (application data), OpenAI (document excerpts and questions, for generation and embeddings), Stripe (billing details), Vercel (hosting). This is the single most-requested procurement artifact and we currently have nothing like it anywhere.
6. **Your control over your data** — deletion behavior and cascade, stated honestly per Bucket 2.
7. **Contact** — a `mailto:` for security questions, procurement review, and vulnerability reports, matching the `privacy@granted.ai` pattern at `privacy.tsx:121`. This is also where a reviewer who needs certification detail gets routed, which is what the removed roadmap section would otherwise have handled.

All copy goes through `/copy-review` before shipping: no "AI-powered", no overselling, and on this page especially, no vague reassurance where a specific verifiable fact would do.

## Files to touch

**New:** `client/src/pages/security.tsx` — mirror the `privacy.tsx` shell (`min-h-screen` wrapper with the inline gradient at `privacy.tsx:10`, `MarketingHeader`, content, `Footer`), but use `max-w-6xl mx-auto px-6` marketing sections instead of the `max-w-3xl` prose card.

**`client/src/App.tsx`** — four small edits:

1. Static import alongside the other page imports (lines 29–39). There is no lazy-loading anywhere in the client, so a static import is correct.
2. Add `"/security"` to `PUBLIC_PATHS` at line 90. Miss this and logged-in visitors get bounced to `/app` by the redirect effect at lines 95–99.
3. Add `<Route path="/security">` to the logged-out block (lines 161–169).
4. Add the same route to the logged-in public block (lines 197–205). **Both are required** — the file duplicates its public routes across the two auth branches.

**`client/src/components/landing/footer.tsx`** — add `<a href="/security" className="hover:text-slate-900">Security</a>` to the link row at lines 8–14.

**`client/src/components/layout/marketing-header.tsx`** — optional. Line 13 has only Pricing today; Privacy and Terms are footer-only. Recommend footer-only to start.

Caveat if the header link is added: `App.tsx:399` defines a **second, duplicate** `MarketingHeader` used by the landing page, separate from `components/layout/marketing-header.tsx` used by the legal and pricing pages. A nav link must go in both or the nav will differ between `/` and `/security`. Worth knowing; not worth fixing in this PR.

## Supporting work

**SEO.** This matters for a page whose purpose is marketing. `client/index.html` has one static title and description for every route, no Open Graph or Twitter card tags, and there is no `robots.txt` or `sitemap.xml` in the repo. A security page that can't be shared with a link preview or found by search is half a page. Smallest useful step: a `useEffect` setting `document.title` on mount. Doing it properly needs a meta-tag helper — reasonable follow-up PR, not a blocker.

**Tests.** Vitest with colocated `*.test.tsx`; `client/src/pages/reset-password.test.tsx` is the closest page-level precedent. No landing or legal page has a test today. A light `security.test.tsx` asserting the page renders and contains its key sections is cheap. Run `npm run check` and `npm run lint` before committing.

## Follow-ups to file separately

- Fix `privacy.tsx:69` to drop Anthropic — a live public inaccuracy, independent of this work.
- Correct the aspirational security claims in `README.md:624–682` (AES-256, column-level encryption, RLS as runtime enforcement).
- Fix pre-existing broken footer anchors: `footer.tsx:11` and `:13` point at `#features` and `#faq`, but neither `FeaturesSection` nor `FAQSection` has a matching `id` (only `how-it-works.tsx:32` does).
- Run `/sync-docs` after merge — a new page and route is a structural change.

## Tracking

Linear was not reachable from the environment where this plan was written (MCP server unauthenticated), so the issue still needs creating. Paste-ready body:

---

**Title:** Add public /security page

**Description:**

Granted has no public security page. Prospective buyers and the IT/procurement reviewers they route us to have nowhere to read how their documents are handled. For an audience that is skeptical of AI hallucination by default, this is a significant gap in the logged-out surface — and we have a strong, verifiable grounding story that no page currently tells.

Full plan, including the code-verified claim audit: `docs/security-page-plan.md`.

Scope:
- New `client/src/pages/security.tsx` (marketing-style sections, reusing `MarketingHeader` + `Footer`)
- Route wiring in `App.tsx` (import, `PUBLIC_PATHS`, **both** logged-out and logged-in public route blocks)
- Footer link in `client/src/components/landing/footer.tsx`
- `document.title` for the page
- `security.test.tsx` render test

Content leads with citation grounding (the differentiator), then document handling, access and isolation, a subprocessor table, and data control. No roadmap/"coming soon" section — the product is launched and the page states current posture.

Blocking before publish — five vendor facts confirmed in Bucket 4 of the plan doc (Supabase bucket privacy, RLS migration applied in prod, Neon/Supabase encryption-at-rest and residency, OpenAI retention tier, executed DPAs). The subprocessor table and any residency language depend on these.

Hard constraint: every claim must trace to Bucket 1 of the plan doc. Do not source copy from `README.md:624–682` — those claims (AES-256 at rest, column-level encryption, RLS as runtime enforcement) are not implemented. No SOC 2, ISO 27001, HIPAA, MFA, pen-testing, or virus-scanning claims.

Sub-issues to split out:
- Fix `privacy.tsx:69` — drops Anthropic (app is OpenAI-only); live public inaccuracy
- Correct `README.md:624–682` security claims
- Per-route meta tags / Open Graph (no SEO meta infrastructure exists today)
- Fix broken footer anchors `#features` / `#faq`
