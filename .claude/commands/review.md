---
description: Codex-gated review loop — trigger Codex on the PR, fix its findings, repeat until clean, then auto-merge (squash)
---

The review gate is **Codex** (`chatgpt-codex-connector`), an independent external reviewer (GPT, not Claude). It runs on GitHub asynchronously: we trigger it with a PR comment, wait for its verdict, fix what it flags, and repeat until it's clean — then auto-merge. Nothing reaches `main` except through a clean Codex pass.

Repo: `baisethomas/granted-ai`. Codex bot login: `chatgpt-codex-connector`.

## 0. Preconditions (stop if any fail)

```bash
git branch --show-current                          # must NOT be main
gh pr view --json number,url,state                 # an OPEN PR must exist
git push                                            # ensure the branch is current before review
```
If on `main` or no open PR: stop and tell the user to run `/start` / `/pr` first.

## 1. (Optional) free local pre-pass

Codex rounds are slow (minutes) and metered. To avoid burning rounds on obvious problems, you MAY first spawn the `pr-reviewer` subagent for a fast local check and fix its BLOCKING items before triggering Codex. This is a convenience, not the gate — skip it if the diff is small.

## 2. Trigger Codex

Record the current latest Codex review so we can detect the new one, then request a review:
```bash
PR=<number>
LAST=$(gh pr view $PR --json reviews \
  --jq '[.reviews[] | select(.author.login=="chatgpt-codex-connector")] | last | .submittedAt // "none"')
gh pr comment $PR --body "@codex review"
```

## 3. Wait for Codex's verdict (poll)

Codex typically takes ~2–6 minutes. Poll for a NEW review from `chatgpt-codex-connector` (one whose `submittedAt` differs from `$LAST`). Poll every ~45s, cap at ~10 minutes:
```bash
for i in $(seq 1 13); do
  sleep 45
  NOW=$(gh pr view $PR --json reviews \
    --jq '[.reviews[] | select(.author.login=="chatgpt-codex-connector")] | last | .submittedAt // "none"')
  [ "$NOW" != "$LAST" ] && [ "$NOW" != "none" ] && break
done
```
If the cap is hit with no new review, stop and tell the user Codex didn't respond (it may be disabled or rate-limited) — do not merge.

## 4. Read Codex's findings

Read both the review body and the inline review comments:
```bash
# summary / body
gh pr view $PR --json reviews \
  --jq '[.reviews[] | select(.author.login=="chatgpt-codex-connector")] | last | .body'
# inline findings (the actionable ones)
gh api repos/baisethomas/granted-ai/pulls/$PR/comments \
  --jq '.[] | select(.user.login=="chatgpt-codex-connector") | {path, line, body}'
```
Codex labels findings by priority — **P1** (critical), **P2** (should fix), **P3** (nit). If it found nothing it reacts 👍 and posts no inline suggestions.

## 5. Branch on the verdict

**Clean** — no P1 or P2 findings (only P3 nits, or a 👍): go to step 6 (merge).

**Findings present** — any P1 or P2:
1. Show the user the P1/P2 list, one line each.
2. Fix **every P1 and P2** at its source. Handle P3 nits too if cheap; skip otherwise and say which.
3. Re-run local gates: `npm run lint`, `npm run check`, relevant tests (`test:auth` / billing).
4. Commit + push: `git commit -am "review: address Codex round <k>"` && `git push`.
5. Go back to **step 2** and re-trigger `@codex review` on the new commit (Codex does not auto-review new pushes — it must be re-triggered).

## 6. Loop cap (prevent runaway)

Cap at **5 rounds**. If Codex still flags P1/P2 after 5 rounds: stop, do NOT merge, leave the findings on the PR, and tell the user it needs a human call (usually a design issue, not a code issue).

## 7. Merge on a clean pass (authorized: auto-merge squash)

A clean Codex pass is the authorized trigger to merge. Confirm the PR is truly mergeable and other checks (Vercel, etc.) are green first:
```bash
gh pr view $PR --json mergeable,mergeStateStatus,statusCheckRollup
```
- Not `MERGEABLE`, or a required check failing/pending → do NOT merge; report and stop.
- Clean → merge through the PR (never a raw push to main):
  ```bash
  gh pr merge $PR --squash --delete-branch
  git checkout main && git pull origin main
  ```
Report the merged PR URL. If the change was structural, remind the user to run `/sync-docs`.

---

## Greptile (second gate — currently disabled)

Greptile (`greptile-apps`) is installed but the trial has hit its **50-credit limit**, so it no longer reviews. To make Greptile a required second gate:
1. Upgrade the plan at https://app.greptile.com/review/github.
2. In step 3, also poll for a new `greptile-apps` review; in step 5, treat its high/critical findings as blocking; in step 7, require both bots clean before merge.

Greptile auto-reviews on PR open/update once credits are available (no comment trigger needed).

## Note on "@codex address that feedback"

Codex can also fix its own findings if you comment `@codex address that feedback` on the PR — an alternative to fixing them yourself. We default to **Claude fixes, Codex reviews** (clean separation of author and reviewer), but the option exists for large mechanical fix sets.
