# Ratchet Project State

<!--
This is the semantic handoff for the current branch/workstream. Keep it short, current, and factual.
Agents update it as meaningful workstream state changes and before handoff.

SAFETY: Never record secrets, credentials, access tokens, personal/customer data, or sensitive security/incident details here. Use sanitized references to the approved protected system instead.

SCOPE: This file is not a globally synchronized live database. Different branches/worktrees may legitimately carry different state until Git integration reconciles them.

Do not turn this into a session transcript. Preserve only the state another competent agent needs to continue this branch/workstream without replaying prior conversations.
-->

## Objective

Install Ratchet in granted-ai (brief PR #62) by merging the drop-in contract into the existing `AGENTS.md` / `CLAUDE.md`, seeding `.ratchet/` memory, and opening one work PR off `main`. Merge, deploy, and env changes stay with the operator.

## Current phase

Re-synced installed Ratchet files on `cursor/install-ratchet-b7d1` (work PR #63) to Ratchet 1.2.1 at main squash `770fc5d8c40fdbc56af5f99ec0e7c82a20b54091`. Upgrade commit `f4f691d755b2ad02259e7a6d15b0cb2eec1ea7a3`. Waiting on Ternary on the new head after this STATE note. Do not merge.

## Completed

- Ran `install.sh --from <Ratchet>/drop-in --to <repo> --claude --codex` on 2026-11-04: added `.ratchet/`, `.agents/skills/`, hooks, `CODEX.md`, and `.claude/skills` symlink; skipped existing `AGENTS.md` and `CLAUDE.md`.
- Appended the filled Ratchet contract to `AGENTS.md` and the Claude adapter to `CLAUDE.md` without deleting prior rules.
- Wired `.claude/settings.json` hooks (lint, stop gate, destructive guard). Stop-hook `CHECKS` is lint + tsc + `test:run`.
- Recorded install decisions in `DECISIONS.md`.
- Opened work PR #63 off `main`.
- Retriggered Ternary with empty commit `3b45146`. Ternary failed on unmodified upstream `.agents/skills/ratchet-init/SKILL.md:14` (source-root traversal).
- Re-synced to Ratchet 1.2.1 (`770fc5d`) via `upgrade.sh --from /tmp/ratchet-121/drop-in --to <repo> --installed-version 1.2.0`. Copied `guard-destructive.sh` and `test-hooks.sh` from 770fc5d so they match byte-for-byte (MERGE would have kept the local db:push fork). Left `AGENTS.md` / `CLAUDE.md` content unchanged.

## Working on

- Ratchet install for granted-ai [open PR #63]
- brief: install-ratchet [open PR #62]
- brief: stale-pr-triage [open PR #61]
- Install Vercel Web Analytics [open PR #60]
- docs: security page plan + code-verified claim audit [open PR #54] (draft in `gh pr list --state open`)
- Sync docs with RLS security fix (PR #49) [open PR #50]
- Route auth emails through branded Resend templates [open PR #45]

## Next

1. Wait for Ternary on the 1.2.1 re-sync head; if it flags unmodified upstream files, stop and report — do not patch them locally.
2. Post one follow-up evidence comment on brief PR #62 (head SHA, source SHA, hash table, placeholder grep, Ternary).
3. Operator reviews and merges (reserved). After merge, rewrite this file on `main`.

## Blocked

- None. Merge of PR #63 is reserved for the operator.

## Important context

- `main` HEAD at install time: `f2bddce` (Clear example values for Stripe configuration). Recent shipped work on main: `/security` page (GRA-78, PRs #55–#58), marketing agent team (#51–#53), RLS (#49), open signup GRA-68 (#48).
- Another brief (`stale-pr-triage`, PR #61) is open. This workstream is scoped to the Ratchet install only and does not triage those PRs.
- Linear issues for Granted AI now live in team LOO; the in-repo Linear tracking rule still says `GRA-<id>` (`CLAUDE.md` `/start`, `.claude/commands/start.md`). Left unchanged on purpose.
- Review/merge gate is still Codex `/review` (`chatgpt-codex-connector`). Ratchet does not replace it.
- App is OpenAI-only; canonical schema is `shared/schema-simple.ts`; no `api/simple.ts`; OCR not implemented. See the five gotchas at the top of `AGENTS.md`.
- `AGENTS.md` / `CLAUDE.md` still carry `ratchet-version: 1.2.0`; hooks and skills are 1.2.1. That marker was left because those two files are project files.

## Verification status

- Upgrade source: `/tmp/ratchet-121/drop-in` at `770fc5d8c40fdbc56af5f99ec0e7c82a20b54091` (Ratchet 1.2.1).
- `cmp` MATCH for `guard-destructive.sh`, `lib-payload.sh`, `source-root.sh`, `upgrade.sh` vs that drop-in.
- `npm run lint && npm run check && npm run test:run` exit 0 — 24 files, 181 tests passed.
- `.claude/hooks/test-hooks.sh` 264 passed, 0 failed (stderr: two `jq: Argument list too long` lines in the large-payload case).
- `.agents/skills/ratchet-bugfix/scripts/test-rrr.sh` 34 passed, 0 failed.
- `.agents/skills/ratchet-handoff/scripts/test-runlog.sh` 49 passed, 0 failed.
- `.agents/skills/ratchet-init/scripts/test-source-root.sh` 17 passed, 0 failed.
- Installed `test-install.sh` / `test-upgrade.sh` exit 1 (fail, not skip) — this repo is not a Ratchet drop-in source. Same scripts from `/tmp/ratchet-121/drop-in` : 48 and 63 passed.
- Narrowed placeholder grep (exclude `.agents`, `.claude`, `.git`) empty (exit 1).
- `AGENTS.md` / `CLAUDE.md` vs pre-upgrade HEAD: unchanged.

## Open risks / assumptions

- Node 22.23.4 / npm 10.9.9 in this environment; CI/preview may differ.
- `npm test` is vitest watch; a future agent that restores the template `CHECKS` will hang the stop hook.
- Ratchet skill and hook files document the template placeholder sentinel (the stop hook greps for it). Seeded `.ratchet/` files and merged `AGENTS.md` / `CLAUDE.md` must not leave that placeholder in a slot.
- `npm run db:push` and `npx drizzle-kit generate` are no longer blocked by the restored 1.2.1 guard. `db:migrate` and `drizzle-kit push` still are.

## Integration note

When PR #63 is merged, rewrite this file against `main`: tag the install `[merged #63]`, keep the other open PRs, and set Next to "use Ratchet pickup on the next workstream". Git is the integration mechanism.

## Last handoff

- Updated: 2026-11-04
- By: agent (Cursor Grok)
- Branch/worktree: cursor/install-ratchet-b7d1
- Last known-good commit: f4f691d755b2ad02259e7a6d15b0cb2eec1ea7a3 (Ratchet 1.2.1 re-sync; this handoff only records that SHA)
