# Security page copy (`/security`)

**Status:** Marketing features layout (Mobbin-informed) on `fix/GRA-78-no-infra-vendor-disclosure`  
**Contact:** support@grantedai.app  
**Do not mention:** 2026 security review · infra vendor names (Neon, Supabase, Vercel, etc.)

---

## Meta
- **Title:** Security | Granted
- **Description:** How Granted keeps your organization's documents scoped to your account — and what happens when you upload and generate a draft.

## Layout (marketing features, not legal blog)

Inspired by Mobbin security/features patterns ([Intercom key features](https://mobbin.com/sites/sections/3ddf998c-d286-4a6e-9e32-0c1738ccd3e7), [Sana AI trust grid](https://mobbin.com/screens/4229415a-4ad1-443f-acad-24ed514f98aa), [Airbnb trust columns](https://mobbin.com/screens/b6e77065-a2cf-4a56-849a-5614b3251341), [ClickUp feature cards](https://mobbin.com/sites/sections/f5b064fa-23cd-4c49-917a-ab66d24f21c8)) and Granted’s own Pricing / Trust sections:

1. Centered hero (eyebrow + brand headline + one sentence + CTAs)
2. 2×2 icon feature cards — trust pillars
3. 4-step “how it works” row — upload → prepare → generate → stay yours
4. 4-up hardening strip
5. Procurement CTA band + privacy/terms links

No single prose column. No “Last updated” in the hero.

## Hero
- **Eyebrow:** Security
- **Headline:** Your org's documents stay yours
- **Supporting:** How Granted scopes access, handles uploads and drafting, and hardens the app — built for teams that need speed without giving up trust.
- **Primary CTA:** Start free
- **Secondary CTA:** Talk to us about security → mailto:support@grantedai.app

## Pillars
1. **Org-scoped access** — Documents, drafts, and org details stay in your workspace. App data APIs require sign-in, and access follows organization membership.
2. **Honest draft processing** — Upload and generation may send relevant text to OpenAI's API to summarize, embed, and draft. That data is not used to train models by default.
3. **Hardened by default** — Secret provider keys (like OpenAI) stay on the server. Production API responses include standard security headers. Data is encrypted in transit and at rest.
4. **Clear boundaries** — We don't sell your personal information or train foundation models on your content. We won't claim certifications we haven't earned.

## Flow
1. Upload — Source materials go into your organization's workspace.
2. Prepare — Document text may be summarized and embedded via OpenAI so relevant passages can be found later.
3. Generate — For a draft, Granted retrieves the best passages and sends those excerpts to OpenAI's API.
4. Stay yours — Answers, citations, and versions save back to your organization.

Training note under the section: OpenAI's API does not use that data to train its models by default. Granted does not use your content to train models.

## Hardening strip
- Sign-in required
- Keys stay server-side
- Security headers (HSTS + CSP on API responses)
- Encrypted in transit and at rest

## Procurement CTA
Evaluating Granted for procurement? Email support@grantedai.app · View pricing · Privacy · Terms
