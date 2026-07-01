---
description: Open a pull request for the current branch — runs checks, drafts the description, then calls gh pr create
---

## Safety check first

1. Run `git branch --show-current`. If the result is `main`, **stop immediately** — do not create the PR. Tell the user: "You're on main. Create a branch first with `/start` or `git checkout -b feat/<name>` before opening a PR."
2. Run `git diff main --stat` to confirm there are commits to review. If empty, report that and stop.

## Run the checklist before opening

Run each of these and report pass/fail before creating the PR:
- `npm run lint`
- `npm run check` (TypeScript)
- If any `auth` files changed: `npm run test:auth`
- If any billing files changed: run billing tests
- Scan the diff for any string matching `sk-`, `ntn_`, `secret_`, or `SUPABASE_SERVICE_ROLE` — fail hard if found

If lint or tsc fails, fix the errors first. Do not open a PR against a broken diff.

## Draft the description

Look at `git diff main` and identify:
1. What changed (files, systems affected)
2. Why (link to the phase in `PROJECT_ROADMAP.md` or the Linear issue if known)
3. How to test it

Format:

```
## What
[1-3 bullets on what was built or changed]

## Why
[1-2 sentences — phase goal, bug fix, or user story from PRD.md]

## How to test
[Numbered steps a reviewer can follow]

## Checklist
- [ ] lint + tsc pass
- [ ] No secrets in diff
- [ ] Usage events logged if LLM calls added
- [ ] Schema changes via db:push, not manual SQL
```

PR title: under 60 chars, imperative tense ("Add clarification engine endpoints", not "Added").

## Create the PR

Once checks pass and the description is drafted, run:

```bash
gh pr create --title "<title>" --body "<description>" --base main
```

Return the PR URL. Do not push to main. Do not merge. The PR is the deliverable — review happens outside this session.
