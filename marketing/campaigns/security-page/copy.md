# Security page copy (`/security`)

**Status:** Marketing features layout — plain-language pass (minimal jargon)  
**Contact:** support@grantedai.app  
**Do not mention:** 2026 security review · infra vendor names (Neon, Supabase, Vercel, etc.)  
**Tone:** Prefer plain language. Name OpenAI honestly. Avoid eng jargon (“server-side,” HSTS/CSP, repeated “API”) — except keep “OpenAI’s API” on the no-training claim (verified policy is API-scoped).

---

## Meta
- **Title:** Security | Granted
- **Description:** How Granted keeps your organization's documents scoped to your account — and what happens when you upload and generate a draft.

## Layout (marketing features, not legal blog)

1. Centered hero (eyebrow + brand headline + one sentence + CTAs)
2. 2×2 icon feature cards — trust pillars
3. 4-step “how it works” row — upload → prepare → generate → stay yours
4. 4-up protections strip
5. Procurement CTA band + privacy/terms links

No single prose column. No “Last updated” in the hero.

## Hero
- **Eyebrow:** Security
- **Headline:** Your org's documents stay yours
- **Supporting:** How Granted scopes access, handles uploads and drafting, and hardens the app — built for teams that need speed without giving up trust.
- **Primary CTA:** Start free
- **Secondary CTA:** Talk to us about security → mailto:support@grantedai.app

## Pillars
1. **Org-scoped access** — Documents, drafts, and org details stay in your workspace. You sign in to reach your org's data, and access follows organization membership.
2. **Honest draft processing** — When you upload or generate a draft, relevant text may go to OpenAI to summarize, find matching passages, and write. OpenAI's API does not use that data to train models by default.
3. **Hardened by default** — OpenAI credentials stay on our servers — never in your browser. In production, we send standard browser security protections. Data is encrypted in transit and at rest.
4. **Clear boundaries** — We don't sell your personal information or train foundation models on your content. We won't claim certifications we haven't earned.

## Flow
1. Upload — Source materials go into your organization's workspace.
2. Prepare — Document text may be summarized and indexed with OpenAI so relevant passages can be found later.
3. Generate — For a draft, Granted finds the best passages and sends those excerpts to OpenAI.
4. Stay yours — Answers, citations, and versions save back to your organization.

Training note under the section: OpenAI's API does not use that data to train its models by default. Granted does not use your content to train models.

**Keep “OpenAI’s API” on the no-training claim only** — the verified policy is API inputs/outputs, not a company-wide OpenAI promise. Elsewhere, prefer plain “OpenAI.”

## Protections strip
- Sign-in required — Your workspace data requires a signed-in account.
- Credentials stay private — OpenAI credentials never ship to your browser.
- Browser protections — In production, we send standard headers that help block common attacks.
- Encrypted in transit and at rest

## Procurement CTA
Evaluating Granted for procurement? Email support@grantedai.app · View pricing · Privacy · Terms
