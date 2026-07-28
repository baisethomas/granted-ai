# Fact-check: Security page claims (2026-07-28)

**Status:** COMPLETE — findings + fix plan below  
**Related:** `brief.md` · [GRA-78](https://linear.app/loomlogiclabs/issue/GRA-78/build-public-security-page-security-trust-marketing-surface)

Checked against: live product code, `/privacy` + FAQ copy, and public Neon / Supabase / Vercel / OpenAI docs.

---

## Verdict summary

| Area | Result |
|---|---|
| Tenant isolation + auth claims | **Pass** — claimable as written |
| Server-only OpenAI key (browser) | **Pass with caveat** — Vite does not expose `OPENAI_API_KEY` unless client code references a `VITE_*` name. Server retains a legacy `VITE_OPENAI_API_KEY` alias for older Vercel envs; prefer `OPENAI_API_KEY` and do not reference the alias from client code. |
| Helmet / HTTP hardening | **Pass** — claimable for production |
| OpenAI processes content for drafts | **Pass** — must say this clearly |
| “We don’t train on your content” | **Pass if rephrased** — Granted doesn’t train; OpenAI API doesn’t train by default. Do not imply Zero Data Retention |
| Encryption at rest / in transit | **Pass if attributed to providers** — Neon, Supabase, Vercel publicly document AES-256 at rest + TLS in transit |
| Specific data residency (region) | **Stay silent / keep Privacy §9** — we did not verify Granted’s Neon/Supabase project regions |
| Anthropic as processor | **Fail in Privacy** — unused; must remove before `/security` ships |
| FAQ “content is not shared” | **Fail** — overstrong; content *is* sent to OpenAI for generation |
| Contact / SLA | **Locked:** `support@grantedai.app`; omit numeric SLA in v1 |
| GRA-34 audit mention | **Skip** — do not mention on `/security` |

---

## 1. Product claims (codebase)

### Pass — organization-scoped access
Storage and routes gate on membership / `organizationId`. Consistent with “another org can’t see yours” in plain language — **don’t say “impossible”**; say access is scoped to your organization membership.

### Pass — authenticated app APIs
User-data routes use `requireSupabaseUser`. Exceptions (Stripe webhook, document worker/cron) are infrastructure endpoints, not end-user data browsers — **don’t claim “every HTTP request requires login.”** Prefer: “App data APIs require a signed-in account.”

### Pass with hygiene fix — provider keys not in the browser
- Vite `define` only injects Supabase URL/anon key + app domain (`vite.config.ts`). No OpenAI key in client bundle config.
- Server generation uses `OPENAI_API_KEY`, with a **legacy server-side fallback** to `VITE_OPENAI_API_KEY` for deployments that still only set the Vite-named var (`server/services/ai.ts`, `embedding.ts`; documented in `VERCEL_ENV_SETUP.md`).
- **Accepted risk / migration:** Prefer `OPENAI_API_KEY` in all new and existing Vercel envs. Keep the alias until every environment is migrated; never import or reference `VITE_OPENAI_API_KEY` from `client/`.
- **Done:** Deleted unused `client/src/lib/rag/*` (including a dead OpenAI client constructor).

### Pass — HTTP hardening
`server/securityHeaders.ts`: Helmet CSP (prod), HSTS (prod), `frameAncestors: 'none'`, referrer policy. Safe to summarize as “production responses include standard browser security headers (including HSTS and a content security policy).” Avoid listing every directive.

### Pass — OpenAI is the only active AI processor
- Generation + embeddings: OpenAI only.
- `@anthropic-ai/sdk` is in `package.json` but **not imported** by app code.
- Privacy §4 naming Anthropic is **false for current product**.

---

## 2. Training / “we don’t use your content” language

### What is true
- Granted does not train foundation models on customer content.
- OpenAI’s API platform policy (as of their public data-controls docs): API inputs/outputs are **not used to train** OpenAI models by default (opt-in only). Abuse-monitoring retention typically up to ~30 days unless Zero Data Retention is configured.
- We have **no evidence** Granted has OpenAI Zero Data Retention (ZDR) enabled — **do not claim ZDR or “OpenAI never stores prompts.”**

### Recommended security-page wording
> When you generate a draft, relevant excerpts from your documents are sent to OpenAI’s API to produce the answer. OpenAI’s API does not use that data to train its models by default. Granted does not use your content to train models.

### Fix related marketing copy
Landing FAQ currently: *“Your content is not shared or used for public model training.”*  
**“Not shared” is wrong** — it is shared with OpenAI for generation. Rephrase to match the above.

Privacy §4: *“We do not use your content to train foundation models without your consent.”*  
OK if “we” = Granted, but pair with an accurate processor list and optionally note OpenAI’s default no-training API policy. Avoid implying a separate consent flow we don’t have.

---

## 3. Encryption & residency (provider docs)

| Provider | Role for Granted | Public claim we can attribute |
|---|---|---|
| [Neon](https://neon.com/docs/security/security-overview) | Postgres + pgvector | AES-256 at rest; TLS required in transit |
| [Supabase](https://supabase.com/security) | Auth + Storage | AES-256 at rest; TLS in transit (their security page) |
| [Vercel](https://vercel.com/docs/security/compliance) | App hosting | AES-256 at rest; HTTPS/TLS in transit |
| OpenAI | Generation + embeddings | Processor for draft generation — not “our servers only” |

### How to say it on `/security`
**Allowed:** “Data is stored with infrastructure providers that encrypt data at rest (AES-256) and encrypt traffic in transit (TLS/HTTPS) — Neon (database), Supabase (auth/files), Vercel (application).”

**Not allowed:**
- Claiming **Granted** is SOC 2 / ISO because Neon/Vercel are
- Naming a specific cloud region without verifying our project settings
- “Your data never leaves our servers”

### Residency
Privacy §9 (US-operated; may transfer to countries where providers operate) remains the safe line until we confirm Neon + Supabase regions in dashboards. **Do not invent “US-only storage.”**

---

## 4. Contact emails & SLA

**Locked 2026-07-28:** `/security` (and security/procurement CTAs on that page) use **`support@grantedai.app`**. Omit numeric response SLA in v1.

| Address | Where it appears | Notes |
|---|---|---|
| `support@grantedai.app` | `/security` (locked) | Security + procurement questions for this page |
| `privacy@granted.ai` | Privacy policy contact | Privacy / rights requests — leave as-is unless you later unify |
| `sales@granted.ai` | Pricing Team/Enterprise | Can stay for plan sales; `/security` should prefer `support@grantedai.app` |
| `support@granted-ai.com` | README only | Domain drift — align later (P2); do not use on `/security` |

---

## 5. GRA-34 audit mention

**Decision (2026-07-28): Skip.** Do not mention the 2026 security review on `/security`.

---

## 6. Fix / address plan

Prioritized work before copy freezes and `/security` ships.

### P0 — Must fix before `/security` (accuracy)

| # | Item | Action |
|---|---|---|
| 1 | Privacy §4 lists Anthropic | Remove Anthropic; say OpenAI (and “other providers we may add, disclosed here”) |
| 2 | Landing FAQ “not shared” | Rewrite to disclose OpenAI processing + no public/model training |
| 3 | Training claim precision | Lock security-page wording to Granted + OpenAI-API-default (no ZDR claim) |
| 4 | Contact map | Use `support@grantedai.app` on `/security`; leave Privacy `privacy@` as-is for now |
| 5 | Privacy §6 | Add cross-link to `/security` when page exists; bump “Last updated” |

### P1 — Should fix in same PR or immediately after (hygiene / claim strength)

| # | Item | Action |
|---|---|---|
| 6 | `VITE_OPENAI_API_KEY` server alias | **Retained** as legacy server-only fallback during env migration; document `OPENAI_API_KEY` as primary (`VERCEL_ENV_SETUP.md`). Remove alias only after all Vercel envs set `OPENAI_API_KEY`. |
| 7 | Dead `client/src/lib/rag/*` | **Done** — deleted unused client OpenAI path |
| 8 | Encryption section | Add provider-attributed AES-256 / TLS bullets to `/security` (sources above) |
| 9 | Auth claim wording | “App data APIs require sign-in” — not “all requests” |

### P2 — Nice follow-ups (not blocking v1 page)

| # | Item | Action |
|---|---|---|
| 10 | Confirm Neon + Supabase regions | Dashboard check → optional residency sentence |
| 11 | Confirm OpenAI ZDR status | If ever enabled, strengthen retention language |
| 12 | Subprocessors list | Separate trust doc later (Stripe, Neon, Supabase, Vercel, OpenAI) |
| 13 | Vulnerability disclosure policy | `security.txt` / dedicated inbox when ready |
| 14 | README support email domain | Align `granted.ai` vs `granted-ai.com` |
| 15 | Unused `@anthropic-ai/sdk` dep | Remove when convenient (docs already note unused) |

### Suggested sequencing for GRA-78

1. ~~**Product decisions** on contact + 2026 review.~~ → `support@grantedai.app`; skip review mention.
2. **Copy PR prep:** Privacy §4 + FAQ rewrite + draft `copy.md` for `/security` using locked claims.
3. **Eng PR:** `/security` page + footer/privacy links + dead `lib/rag` cleanup; retain `VITE_OPENAI_API_KEY` as documented legacy server alias until envs migrate.
4. Brand-voice pass on final copy.
5. Ship via `/review`.

---

## 7. Updated claim inventory (post fact-check)

### May claim
- Org-scoped access via membership
- App data APIs require Supabase auth
- OpenAI API key is server-side only (primary: `OPENAI_API_KEY`; legacy server alias `VITE_OPENAI_API_KEY` accepted during migration — never referenced from client)
- Production HTTP security headers (Helmet)
- Draft generation sends relevant document context to OpenAI’s API
- Granted does not train models on your content; OpenAI API does not train on API data by default
- Infrastructure providers encrypt at rest (AES-256) and in transit (TLS/HTTPS) — Neon, Supabase, Vercel
- Contact: `support@grantedai.app` for security / procurement on `/security`

### Still must not claim
- SOC 2 / ISO / HIPAA / FedRAMP for Granted
- OpenAI Zero Data Retention / “prompts never stored”
- “Content is never shared with third parties”
- Anthropic as a current processor
- Specific US-only residency (until verified)
- Numeric security response SLA (until real)
- Bug bounty, pen-test results, breach history

---

## Sources

- Neon security overview: https://neon.com/docs/security/security-overview  
- Supabase security: https://supabase.com/security  
- Vercel compliance / encryption: https://vercel.com/docs/security/compliance  
- OpenAI API data controls: https://platform.openai.com/docs/guides/your-data  
- Code: `server/securityHeaders.ts`, `server/services/ai.ts`, `server/middleware/supabaseAuth.ts`, `vite.config.ts`, `client/src/pages/privacy.tsx`, `client/src/components/landing/faq-section.tsx`
