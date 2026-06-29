# Sign-up plan choice — manual E2E checklist

Use this checklist in **staging** after deploying the GRA-46 sign-up plan flow.

## Prerequisites

- Staging app URL with Supabase auth configured
- Stripe test mode keys in environment:
  - `STRIPE_SECRET_KEY` (test)
  - `STRIPE_WEBHOOK_SECRET` (test endpoint)
  - `STRIPE_PRO_PRICE_ID` (test price)
- Optional fallback: `STRIPE_PRO_PAYMENT_LINK_URL`
- Test card: `4242 4242 4242 4242`, any future expiry, any CVC

## Free / Starter path

1. Open `/auth?plan=starter` (or Pricing → **Start Free**).
2. Confirm sign-up form shows **Starter** selected.
3. Create account (email or Google).
4. Confirm redirect lands on `/app` with **no** Stripe Checkout.
5. Open Settings → Billing and confirm workspace is on Starter limits.

## Pro path (email sign-up)

1. Open `/auth?plan=pro` (or Pricing → **Try Pro** while logged out).
2. Confirm **Pro** is selected on sign-up.
3. Create account with a new email.
4. Confirm brief “Redirecting to secure checkout…” then Stripe Checkout opens.
5. Complete checkout with the test card.
6. Confirm return to `/app?checkout=success`.
7. Verify subscription state in Settings → Billing (Pro plan, active period).

## Pro path (Google sign-up)

1. Log out. Open `/auth?plan=pro` and switch to sign-up if needed.
2. Select **Pro**, click **Continue with Google**.
3. Complete Google OAuth.
4. Confirm Stripe Checkout opens (not `/app` first without checkout).

## Sign-in regression

1. Log out an existing Starter user.
2. Sign in (not sign-up) from `/auth` — no plan selector required.
3. Confirm direct entry to `/app` with no checkout redirect.

## Webhook sanity (paid completion)

1. After a successful Pro checkout, confirm org record has `stripe_customer_id` and subscription metadata updated (DB or Settings UI).
2. Stripe Dashboard → Webhooks: `checkout.session.completed` delivered successfully for the test session.

## Notes

- Pending plan choice is stored in `sessionStorage` only for the sign-up flow; sign-in does not set it.
- If checkout creation fails, the user remains authenticated and can retry from Pricing or Settings.
