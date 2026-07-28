# Plan: Public Security Page (`/security`)

**Status:** APPROVED 2026-07-28 — plan locked. Page not built; no launch assets yet.
**Owner:** Product + Marketing
**Tracking:** [GRA-78](https://linear.app/loomlogiclabs/issue/GRA-78/build-public-security-page-security-trust-marketing-surface) · [Notion plan](https://app.notion.com/p/3abae4c3f2ef815da3bfd904801d6d92)
**Created:** 2026-07-28

## Why this page

Nonprofit buyers (especially EDs and boards evaluating tools that hold mission documents, budgets, and draft grant language) ask the same questions before they trust a drafting product:

1. Who can see our data?
2. Where does it go when we generate a draft?
3. Can another organization ever see ours?
4. Do you have a page I can send to our board / IT / funder due diligence?

Today Granted only has a one-paragraph Security section inside `/privacy`, footer links to Privacy + Terms (no Security), and an Enterprise pricing bullet for “Security and procurement review.” There is **no dedicated `/security` page** and **no prior marketing plan** for one.

This plan covers building that page as a trust surface — not a paid-ad campaign. Optional awareness posts come after the page ships.

---

## 1. Goal

Ship a public marketing page at `/security` that answers due-diligence questions in plain language, links from Privacy / Terms / Footer / Pricing (Enterprise), and gives Enterprise prospects something concrete to review before a sales conversation.

**Measurable outcomes (post-launch):**

- Page is live and linked from footer + pricing Enterprise path
- Enterprise inquiry emails that mention “saw your security page” (qualitative)
- Optional: `/security` sessions in web analytics once instrumentation exists (no fabricated baseline)

This is a **trust / procurement** play, not a signup-conversion campaign. Primary CTA should support evaluation (“Start free” or “Talk to us about Enterprise”), not hard sell.

## 2. Audience

| Segment | Job to be done |
|---|---|
| Solo ED / grant lead evaluating signup | “Is it safe to upload our documents?” |
| Board / IT / ops reviewer | One URL for due diligence checklist |
| Enterprise / institution prospect | Pre-read before “Security and procurement review” call |
| Grant professionals comparing tools | Compare isolation + AI data handling without sales theater |

Feeling to speak to: caution, not fear. Skeptical buyers want specifics they can verify — not “bank-grade” clichés.

## 3. Core angle

**“Your org’s documents stay yours — here’s exactly how.”**

One angle: tenant boundaries + honest AI processing disclosure. Ladder everything to that. Do not dilute with feature marketing (citations, speed, version history) except where they reinforce trust (e.g. “we don’t invent sources” is product trust, not page security — keep it light or omit).

## 4. Claim inventory (truth-bound)

Only claim what the product actually does today. **Do not invent certifications.**

### May claim (backed by current product)

| Claim | Grounding |
|---|---|
| Organization-scoped data access | Every user-data query filters by `organizationId`; access via `server/storage.ts` |
| Auth required for app APIs | `requireSupabaseUser` on protected routes; Supabase Auth primary |
| Provider API keys never shipped to the browser | `OPENAI_API_KEY` server-only; client gets Supabase anon key only |
| HTTP hardening headers in production | Helmet: CSP, HSTS (prod), `frameAncestors: none`, referrer policy — `server/securityHeaders.ts` |
| Uploaded content may be sent to OpenAI to generate drafts | Privacy policy §4; OpenAI-only generation in practice |
| We do not use your content to train foundation models without consent | Privacy policy §4 (keep aligned; don’t invent stronger contractual language) |
| Contact for security / procurement questions | `support@grantedai.app` (locked 2026-07-28) |

### Must not claim (unless later verified and approved)

- SOC 2 / ISO 27001 / HIPAA / FedRAMP / “compliant with …”
- Penetration-test results, bug-bounty program, or “zero breaches”
- Encryption-at-rest / in-transit details beyond what we can confirm from Neon / Supabase / Vercel docs **after** a short infra fact-check pass
- “Your data never leaves our servers” (false — generation uses OpenAI)
- Anthropic as an active processor (SDK unused; privacy copy still mentions it — **reconcile privacy vs. security page** before launch)
- Fabricated uptime, “military-grade,” or competitor comparisons

### Fact-check pass before copy freezes

**Done 2026-07-28** — see `fact-check.md`.

1. ~~Confirm encryption / residency language with Neon + Supabase + Vercel public docs (or stay silent).~~ → Provider-attributed AES-256/TLS OK; stay silent on specific region.
2. ~~Align Privacy §4 with reality (OpenAI-only today; Anthropic aspirational).~~ → **Must fix:** remove Anthropic; fix FAQ “not shared.”
3. ~~Decide whether to mention GRA-34 audit at all.~~ → **Skip** — do not mention the 2026 review on `/security`.
4. ~~Confirm security contact email and expected response SLA.~~ → **`support@grantedai.app`**; omit numeric SLA in v1.

## 5. Page structure (build brief)

Mirror marketing chrome used by `/privacy` and `/terms` (`MarketingHeader` + `Footer`), but write it as a **product trust page**, not a legal wall of text.

Suggested sections (one job each):

1. **Hero** — Brand + headline + one supporting sentence + CTA pair (Start free | Contact for Enterprise review). No cards, no badge clusters, no “certified” stickers.
2. **Who can access your data** — Org membership, authenticated APIs, tenant isolation in plain English.
3. **What happens when you generate a draft** — Upload → retrieve → generate via OpenAI → store answer/citations in your org. Explicit: content is processed to produce your draft.
4. **How we harden the app** — Auth, server-only secrets, security headers. Short; no architecture dump.
5. **What we don’t do** — No selling personal data; no training foundation models on your content without consent (match privacy).
6. **Enterprise / procurement** — Link to pricing Enterprise path; security/procurement questions go to `mailto:support@grantedai.app`.
7. **Related policies** — Links to `/privacy`, `/terms`.

**Route work (engineering):**

- Add `client/src/pages/security.tsx`
- Register `/security` in `client/src/App.tsx` (both marketing-domain and logged-in public path lists, same pattern as `/privacy` / `/terms`)
- Footer link: Security
- Optional: Pricing Enterprise feature or FAQ link; Privacy §6 “see our Security page”
- SEO: title/description consistent with other marketing pages

**Out of scope for v1:** downloadable security PDF, DPA template, subprocessors table (nice-to-have follow-up), status page, trust center SaaS.

## 6. Channel plan (after page ships)

| Channel | Job |
|---|---|
| Website `/security` | Canonical trust surface |
| Footer + Privacy cross-links | Discoverability for evaluators already on site |
| Pricing → Enterprise | Pre-qualify procurement conversations |
| LinkedIn (1 post, optional) | Soft awareness: “We published how we handle your documents” — only after page is live |
| Email / ads | Out of scope for v1 |

No multi-week content calendar until the page exists.

## 7. Build sequence

| Step | Owner | Deliverable |
|---|---|---|
| A. Approve this brief + claim inventory | You | Sign-off / edits |
| B. Fact-check pass (infra + privacy alignment) | Eng + Product | Short checklist in this folder or Linear comments |
| C. Page copy draft | content-generator + brand-voice | `copy.md` in this folder |
| D. Implement `/security` page + links | Eng | PR → `/review` |
| E. Notion + Linear status → Done | Agent / you | Tracking closed |
| F. Optional LinkedIn post | social-media-manager | Only if requested after ship |

## 8. Success metrics

- **Ship:** page live, footer + privacy linked
- **Use:** cited in ≥1 Enterprise / sales conversation within 30 days of ship (manual note)
- **Quality:** brand-voice pass; zero unapproved claims from “Must not claim”
- **Not goals for v1:** paid CAC, signup attribution from `/security` alone

## 9. Risks

| Risk | Mitigation |
|---|---|
| Overclaiming certifications | Claim inventory gate; brand-voice review |
| Privacy policy drift (Anthropic mentioned, unused) | Align privacy + security copy in same PR if needed |
| Page reads like a legal dump | Short sections, plain language, link out to privacy for legalese |
| Audit mention creates curiosity about old findings | Mitigated — review mention skipped on `/security` |

## 10. Package location

```
marketing/campaigns/security-page/
  brief.md       ← plan
  fact-check.md  ← claim verification
  copy.md        ← page copy source
```

Images: none required for v1 (text-first trust page). If a visual is later needed, use `visual-producer` / `npm run marketing:image`.
