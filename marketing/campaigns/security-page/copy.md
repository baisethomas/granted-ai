# Security page copy (`/security`)

**Status:** Implemented in `client/src/pages/security.tsx` (GRA-78) — source of truth for page copy  
**Contact:** support@grantedai.app  
**Do not mention:** 2026 security review

---

## Meta
- **Title:** Security | Granted
- **Description:** How Granted keeps your organization's documents scoped to your account — and what happens when you generate a draft.

## Hero
- **Eyebrow:** Security
- **Headline:** Your org's documents stay yours
- **Supporting:** Here's how Granted scopes access, handles draft generation, and protects the app — in plain language.
- **Primary CTA:** Start free → `getAuthUrl("starter")`
- **Secondary CTA:** Contact us → `mailto:support@grantedai.app?subject=Security%20or%20procurement%20question`

## Who can access your data
**Heading:** Who can access your data

Your documents, drafts, and organization details live inside your organization's workspace. App data APIs require a signed-in account, and access is scoped to organization membership — another organization's account cannot open yours.

## What happens when you upload and generate
**Heading:** What happens when you upload and generate

1. You upload source materials to your organization.
2. Granted may send document text to OpenAI's API to create a summary and embeddings so we can find relevant passages later.
3. When you generate a draft, Granted retrieves the most relevant passages and sends those excerpts to OpenAI's API to draft an answer.
4. The answer, citations, and versions are saved back to your organization.

OpenAI's API does not use that data to train its models by default. Granted does not use your content to train models.

## How we harden the app
**Heading:** How we harden the app

- Sign-in required for app access
- OpenAI API keys stay on the server — they are not shipped to the browser
- API responses include standard security headers (including HSTS and a content security policy)
- Data is encrypted in transit and at rest

**Do not name** hosting/database/auth vendors (Neon, Supabase, Vercel, etc.) on the public page or in marketing copy — that discloses infrastructure. Keep OpenAI named only as the AI processor for upload/draft flows.

## What we don't do
**Heading:** What we don't do

- We do not sell your personal information
- We do not use your content to train foundation models
- We do not claim certifications we haven't earned — if you need a formal security review for procurement, email us

## Enterprise / procurement
**Heading:** Security and procurement questions

Evaluating Granted for a larger rollout? Email [support@grantedai.app](mailto:support@grantedai.app) with security or procurement questions. You can also see plans on our [pricing page](/pricing).

## Related
See also our [Privacy Policy](/privacy) and [Terms of Service](/terms).

---

## Companion fixes (same ship)

### Privacy §4 — replace with:
Content you upload or submit to the Service may be processed by OpenAI (our current AI provider) to summarize documents, generate embeddings for retrieval, and produce draft responses on your behalf. We take reasonable steps to select providers with appropriate data handling practices. We do not use your content to train foundation models. OpenAI's API does not use API inputs or outputs to train its models by default.

### Privacy §6 — append:
For a plain-language overview of how we handle access, draft generation, and app hardening, see our [Security](/security) page.

### Landing FAQ — replace answer for "How does Granted use our documents?":
We build a private, per-organization knowledge base to tailor responses. When you upload documents, Granted may send text to OpenAI's API for summarization and embeddings. When you generate a draft, relevant excerpts may also be sent to OpenAI to produce the answer. That data is not used to train OpenAI's models by default, and Granted does not use your content for model training.
