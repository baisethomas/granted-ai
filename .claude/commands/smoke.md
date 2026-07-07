---
description: Scripted golden-path smoke test — auth → project → upload → process → generate → verify citations, against the local dev server
---

Walks the product's golden path end-to-end through the real API, the way a design partner would hit it. Run it before `/pr` on anything touching the golden path (auth, projects, documents, the pipeline, generation) and after merges that combined several branches. This is the check that catches "onboarding blocker" bugs (like PR #23's missing default-org provisioning) before a user does.

Every step reports **PASS/FAIL**; on the first FAIL, stop, show the exact request + response body, and diagnose (for processing failures, hand off to `/pipeline-doctor`). Never report a partial run as a pass.

## 0. Preconditions

- `.env.local` present with `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
- **This writes real rows to whatever DB `DATABASE_URL` points at.** That's expected for the dev DB; the run cleans up after itself (step 8). If `DATABASE_URL` looks like production, stop and ask.
- Cost note: one document summary + one generation ≈ a few cents of OpenAI spend, metered normally through the app's own billing gates.

## 1. Dev server up

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/api/health || true
```
If nothing is listening on 5001, start `npm run dev` in the background and wait for the listen log (cap 60s). Don't start a second server if one is running.

## 2. Test identity + token

```bash
npm run auth:create-test-user -- smoke@grantedai.app SmokeTest123!   # idempotent: creates or resets
```
Then mint a session token via the Supabase password grant (values from `.env.local`; never echo the service-role key):
```bash
TOKEN=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"smoke@grantedai.app","password":"SmokeTest123!"}' | jq -r .access_token)
AUTH="Authorization: Bearer $TOKEN"
```
FAIL if `$TOKEN` is empty/null. Then run the auth smoke as the first assertion:
```bash
SUPABASE_TEST_ACCESS_TOKEN=$TOKEN npm run test:auth
```

## 3. Organization exists (onboarding path)

```bash
curl -s http://localhost:5001/api/organizations -H "$AUTH"
```
PASS = 200 with ≥1 org (default-org provisioning is part of onboarding — an empty list for a fresh user is itself a bug; report it, then create one via `POST /api/organizations` to continue). Record `ORG_ID`.

## 4. Project

```bash
PROJECT_ID=$(curl -s -X POST http://localhost:5001/api/projects -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"title":"Smoke Test Project","funder":"Smoke Test Funder"}' | jq -r .id)
```
PASS = non-null id. A 402/limit denial means the smoke user hit its plan cap — delete old smoke projects and retry once.

## 5. Upload + process a real fixture

```bash
DOC_ID=$(curl -s -X POST http://localhost:5001/api/documents/upload -H "$AUTH" \
  -F "file=@test/fixtures/nonprofit/community-impact-brief.docx" | jq -r .id)
npm run doc:process     # runs the worker locally (the HTTP trigger needs DOCUMENT_WORKER_API_KEY)
```
Then poll (every 5s, cap 2 min):
```bash
curl -s http://localhost:5001/api/documents -H "$AUTH" | jq '.[] | select(.id=="'$DOC_ID'") | {processed, embeddingStatus, processingError}'
```
PASS = `processed: true` and `embeddingStatus: "complete"`. FAIL → capture `processingError` and hand off to `/pipeline-doctor`.

## 6. Question + generation (the product moment)

```bash
Q_ID=$(curl -s -X POST http://localhost:5001/api/projects/$PROJECT_ID/questions -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"question":"How many families does the organization serve each month, and across what area?"}' | jq -r .id)
curl -s -X POST http://localhost:5001/api/questions/$Q_ID/generate -H "$AUTH" > /tmp/smoke-gen.json
```
Assert ALL of, from `/tmp/smoke-gen.json`:
- HTTP 200 and `responseStatus == "complete"` (206/`needs_context` = retrieval found nothing from a doc we just processed — that is a FAIL of the pipeline, not a soft pass)
- `.response` is non-empty plain text containing at least one `[#N]` marker
- `.citations | length >= 1`, and every citation has a `documentId` matching `$DOC_ID`
- `.assumptions` is an array (may be empty)
- The number in the answer (the fixture says 850 families) appears in the cited chunk content — spot-check one citation's `quote` against the fixture

## 7. Version history

```bash
curl -s http://localhost:5001/api/questions/$Q_ID/versions -H "$AUTH" | jq length
```
PASS = ≥ 1.

## 8. Cleanup (always, even after FAIL — skip only what was never created)

```bash
curl -s -X DELETE http://localhost:5001/api/projects/$PROJECT_ID -H "$AUTH"
curl -s -X DELETE http://localhost:5001/api/documents/$DOC_ID -H "$AUTH"
```

## 9. Report

Output a table: step | PASS/FAIL | evidence (one line). Then a verdict sentence: golden path clean, or the first broken step and the suspected cause. Include total OpenAI spend estimate. If any step failed, do not open a PR until it's fixed and this command reruns clean.
