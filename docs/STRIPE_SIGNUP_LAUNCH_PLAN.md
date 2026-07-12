# Stripe + Signup Launch Plan

Handoff plan for taking the billing integration and signup flow from "built in test mode" to production-ready. Written 2026-07-11 after a code audit and a Mobbin pattern review (Perplexity, Claude, Qatalog, Langdock signups; GitHub, Clockwise, PandaDoc, Teachable upgrade/checkout flows).

**TL;DR: the Stripe integration is ~80% built.** Checkout, webhooks, the billing portal, plan enforcement, and the Plan & billing tab all exist and are tested. What stands between here and launch is mostly *configuration* (Stripe live mode, Supabase auth settings, env vars) plus a handful of signup-UX gaps.

---

## 1. What's already built (verified in code)

### Billing (server)
| Piece | Where | Status |
|---|---|---|
| Checkout session creation | `server/services/stripeBilling.ts` → `POST /api/billing/checkout` | ✅ Built. `success_url: /app?checkout=success`, `cancel_url: /pricing?checkout=canceled` |
| Webhook handler | `POST /api/billing/webhook` (raw body via `express.raw`, signature verified with `constructEvent`) | ✅ Built. Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| Billing portal sessions | `POST /api/billing/portal` | ✅ Built, first UI consumer shipped in PR #35 |
| Plan enforcement | `billingService.checkLimit` on `projects` / `documents` / `ai_tokens` routes | ✅ Built + tested |
| Payment-link fallback | `STRIPE_PRO_PAYMENT_LINK_URL` used when no secret key | ✅ Works, but see §3.1 — should not survive into production |
| Subscription state | `subscriptions` table, plan synced by webhooks | ✅ Built; provisioning race fixed in GRA-61 |

### Signup (client + Supabase)
| Piece | Where | Status |
|---|---|---|
| Email + password signup/login | `client/src/components/Login.tsx`, `useAuth` → Supabase | ✅ Built |
| Google OAuth | `signInWithGoogle` in `client/src/lib/supabase.ts` | ✅ Built (needs prod OAuth config, §3.2) |
| Paid-intent handoff | `client/src/lib/signup-plan.ts` — Pricing → signup (`signup_plan` metadata + localStorage) → auto-checkout after auth | ✅ Built + unit tested; explicit-upgrade path clears stale intent (PR #35) |
| Plan & billing tab | `client/src/components/settings/PlanBilling.tsx` — upgrade, restart after cancel, portal, usage meters | ✅ Built |

---

## 2. Gaps found in the audit (code work)

Ordered by launch impact. Mobbin references describe the pattern to follow.

### 2.0 Production webhook is broken: raw body never reaches signature verification — **P0, blocks billing entirely** (GRA-66)
`server/index.ts:31` scopes `express.raw()` to `/api/billing/webhook` — but the **Vercel production entry `api/server.ts` applies `express.json()` globally with no raw-body carve-out**. `stripe.webhooks.constructEvent` requires the exact raw bytes, so in production every webhook fails signature verification: subscriptions never activate after checkout, cancellations never sync. Dev works; prod doesn't.
**Do:** mirror the scoped `express.raw()` middleware in `api/server.ts` ahead of `express.json()`. Must land before webhook registration (§3.1.4) means anything.

### 2.1 No "check your email" state after signup — **P1 if email confirmation is on**
`Login.tsx` has no confirmation-pending UI. If the Supabase project has "Confirm email" enabled, a new user who signs up sees… nothing actionable. Every signup flow reviewed (Perplexity, Claude, Qatalog) has an explicit *check your email* screen, and the best ones accept a 6-digit code inline rather than requiring a click-through.
**Do:** add a post-signup state to `Login.tsx`: "We sent a confirmation link to {email}" + resend button (`supabase.auth.resend()`). Decide the confirmation policy first (§3.2). Brand voice: state what happened + what to do next.

### 2.2 No password reset — **P1**
No `resetPasswordForEmail` anywhere in the client. Locked-out users have no self-serve path — for a paid product this generates support email from day one.
**Do:** "Forgot password?" link on the login form → `supabase.auth.resetPasswordForEmail(email, { redirectTo: <app>/auth/reset })` → reset page that calls `supabase.auth.updateUser({ password })`. Needs the redirect URL added in Supabase (§3.2).

### 2.3 Checkout return is unhandled in the UI — **P2**
The server sets `success_url: /app?checkout=success` and `cancel_url: /pricing?checkout=canceled`, but nothing in the client reads either param. Post-payment, the user lands on the dashboard with no acknowledgment — and because the plan flips via webhook (async), the Plan & billing tab may still say Starter for a few seconds. Teachable's pattern: explicit "payment processing…" interstitial; GitHub confirms then routes to billing.
**Do:** on `checkout=success`, show a toast/banner ("You're on Pro — receipt is in your email") and poll `billingUsage` (the query key already exists in `workspace-query-keys.ts`) until the webhook lands; on `checkout=canceled`, a quiet "Checkout canceled — your plan is unchanged" on Pricing.

### 2.4 Signup asks for the org name never — **P3 (nice-to-have)**
The default workspace is auto-named "My Organization." Qatalog/Langdock ask 1–2 light questions post-signup (org name, size) and use them. Granted already collects org context later (Organization page, org-memory suggestions), so keep this minimal or skip: a single optional "Organization name" field on the signup form. Note the transport gap: signup itself never calls `ensureDefaultOrganizationForUser` — the org is provisioned later by the first `GET /api/organizations`, which passes no display name. Plumbing needed: store the name in signup metadata (like `signup_plan`) and have the provisioning path read it, or add a dedicated first-run endpoint.

### 2.5 No annual pricing — **P3 (decision, then small code)**
Pricing page and checkout are monthly-only (one `STRIPE_PRO_PRICE_ID`). Every reference flow has a monthly/annual toggle with a savings callout, and annual prepay matters for nonprofit budgeting cycles (grant-funded orgs often prefer invoiced annual). If wanted: second Price in Stripe, cadence toggle on `pricing.tsx`, pass the chosen price id to `/api/billing/checkout`.

---

## 3. Configuration runbook (no code — dashboards + env)

These are **owner actions** (they need your Stripe/Supabase/Google/Vercel logins). Each is small; the order matters.

### 3.1 Stripe (live mode)
1. Activate the Stripe account (business profile, bank payout details) — *human-only, do first; Stripe's review can take a day.*
2. Create the live **Product + Price**: "Granted Pro" monthly (and annual if §2.5 is a yes). Copy the live `price_...` id.
3. Set Vercel env (Production): `STRIPE_SECRET_KEY` (live `sk_live_...`), `STRIPE_PRO_PRICE_ID`. ⚠️ The code has a **hardcoded fallback price id** (`stripeBilling.ts:4-5`, a test-mode price) — with a live secret key and no env price id, checkout would 500 against a nonexistent price. Set the env var; consider a follow-up PR to fail loudly instead of falling back.
4. Register the webhook endpoint in Stripe: `https://<prod-domain>/api/billing/webhook`, events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret → Vercel `STRIPE_WEBHOOK_SECRET`.
5. Configure the **Customer Portal** in Stripe dashboard (Settings → Billing → Customer portal): allow payment-method update, invoice history, cancellation (at period end). The portal API call is already wired; it just needs the dashboard config saved once.
6. Decide the fate of `STRIPE_PRO_PAYMENT_LINK_URL`: it's a dev fallback used when no secret key is present. In production either leave it unset (recommended once live keys exist) or point it at a live payment link — never the test link.
7. Branding: upload logo + set brand color `#2186EB` in Stripe (Settings → Branding) so Checkout and the portal look like Granted.

### 3.2 Supabase Auth
1. **Decide email confirmation policy** (drives §2.1): ON is standard for a paid SaaS (deliverability + abuse); if ON, the check-your-email UX must ship in the same release.
2. Auth → URL Configuration: set Site URL to the prod domain; add redirect URLs for `/auth`, `/auth/reset` (for §2.2), and the OAuth callback.
3. Google OAuth for production: in Google Cloud Console, add the prod domain to the OAuth consent screen + authorized redirect URI (`https://<project>.supabase.co/auth/v1/callback`); paste client id/secret into Supabase Auth providers. Publish the consent screen (unverified-app warning otherwise) — *human-only, allow a few days if Google review is triggered.*
4. Customize auth email templates (confirmation, reset) — Supabase defaults look like Supabase, not Granted. Match brand voice: what happened + what to do next.
5. SMTP: Supabase's built-in sender is rate-limited (~4/hr on free tier) and lands in spam. For launch, configure custom SMTP (Resend/Postmark) under Auth → SMTP — *human-only account creation, then env/config.*

### 3.3 Vercel
1. Confirm all `STRIPE_*` env vars exist in the **Production** environment specifically (not just Preview/Development).
2. `SESSION_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `DATABASE_URL`, `OPENAI_API_KEY` — verify against `.env.example`. (The client reads the `VITE_*` names; `NEXT_PUBLIC_SUPABASE_*` work only as legacy fallbacks via `vite.config.ts` — prefer the canonical `VITE_*` in new environments.)
3. After setting env vars, redeploy (env changes don't apply to existing deployments).

---

## 4. Test plan (before announcing)

Stripe test mode first (test keys in Preview env), then one real charge on live.

1. **Free signup:** new email → confirm (if ON) → land on dashboard → HomeGuidance checklist shows. Starter limits enforce (create projects/docs until `checkLimit` blocks with the upgrade prompt).
2. **Paid-intent signup:** Pricing → "Get Pro" → sign up → confirm → checkout opens automatically (the `signup_plan` handoff) → pay with `4242 4242 4242 4242` → land on `/app?checkout=success` → plan flips to Pro after webhook (watch `stripe listen --forward-to localhost:5001/api/billing/webhook` locally, or the Stripe dashboard event log in prod).
3. **Upgrade from Settings:** Starter user → Plan & billing → Upgrade → pay → meters/plan update.
4. **Portal:** Pro user → Manage billing → update card, download invoice, cancel at period end → tab shows "Your plan ends on {date}"; after period end (or immediate-cancel in test), plan reverts to Starter and "Restart Pro" appears.
5. **Webhook resilience:** in Stripe dashboard, resend a `checkout.session.completed` event — must be idempotent (no duplicate subscription rows). Send with a bad signature — must 400.
6. **Failure paths:** declined card (`4000 0000 0000 0002`), abandoning checkout (cancel URL), password reset end-to-end, Google OAuth on the prod domain, signup with an already-registered email.
7. **The GRA-61 regression check:** restart the prod-pointed dev server mid-test; data must persist.

---

## 5. Suggested sequencing

| Order | Work | Who | Size |
|---|---|---|---|
| 0 | Fix prod webhook raw body (§2.0, GRA-66) | Claude session | 1 small branch — **blocks everything billing** |
| 1 | Stripe account activation + live product/price (§3.1.1–2) | Owner | 30 min + review wait |
| 2 | Supabase prod auth config + email policy decision (§3.2) | Owner | 1 hr |
| 3 | Check-your-email state + password reset (§2.1, §2.2) | Claude session | 1 branch, ~half day incl. review |
| 4 | Checkout return handling (§2.3) | Claude session | 1 small branch |
| 5 | Env vars + webhook registration + portal config (§3.1.3–7, §3.3) | Owner (Claude can verify) | 1 hr |
| 6 | Full test-mode pass, then live smoke test (§4) | Both | half day |
| 7 | Optional: annual price, org-name field (§2.4, §2.5) | Decide later | — |

Items 3 and 4 are independent of the dashboard work and can start immediately.

---

*Mobbin flows referenced: Perplexity web onboarding (inline code verification), Claude web onboarding (consent step, verified-email footer), Qatalog onboarding (light profiling steps, signing-up-as escape hatch), Langdock trial signup, GitHub upgrade (due-today + next-payment clarity), Clockwise upgrade (cadence toggle, cancel-anytime fine print), PandaDoc payment modal (order summary + promo code), Teachable upgrade (processing interstitial, billing page with invoices).*
