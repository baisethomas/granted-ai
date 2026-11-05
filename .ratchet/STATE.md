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

Re-synced installed Ratchet files on `cursor/install-ratchet-b7d1` (work PR #63) to Ratchet 1.3.0 at main squash `11a02d0dca64c9af6bc11400d693b7cea9a77c03`. Restored the `db:push` / `generate` block via `.ratchet/guard-destructive.rules` (no hook fork). Waiting on Ternary on the new head. Do not merge.

## Completed

- Ran `install.sh --from <Ratchet>/drop-in --to <repo> --claude --codex` on 2026-11-04: added `.ratchet/`, `.agents/skills/`, hooks, `CODEX.md`, and `.claude/skills` symlink; skipped existing `AGENTS.md` and `CLAUDE.md`.
- Appended the filled Ratchet contract to `AGENTS.md` and the Claude adapter to `CLAUDE.md` without deleting prior rules.
- Wired `.claude/settings.json` hooks (lint, stop gate, destructive guard). Stop-hook `CHECKS` is lint + tsc + `test:run`.
- Recorded install decisions in `DECISIONS.md`.
- Opened work PR #63 off `main`.
- Re-synced to Ratchet 1.2.1 (`770fc5d`) and restored `guard-destructive.sh` byte-for-byte (dropped the local db:push fork). See D-20261104-2326.
- Re-synced to Ratchet 1.3.0 (`11a02d0`) via `upgrade.sh --from /tmp/ratchet-130/drop-in --to <repo> --installed-version 1.2.1`. Applied every MERGE except `AGENTS.md` / `CLAUDE.md` (CONFLICT, left as project files). Added `.ratchet/guard-destructive.rules` with the documented `npm run db:push` and `drizzle-kit generate` patterns. See D-20261105-0125.

## Working on

- Ratchet install for granted-ai [open PR #63]
- brief: install-ratchet [open PR #62]
- brief: stale-pr-triage [open PR #61]
- Install Vercel Web Analytics [open PR #60]
- docs: security page plan + code-verified claim audit [open PR #54] (draft in `gh pr list --state open`)
- Sync docs with RLS security fix (PR #49) [open PR #50]
- Route auth emails through branded Resend templates [open PR #45]

## Next

1. Wait for Ternary on the 1.3.0 re-sync head; if it flags unmodified upstream files, stop and report — do not patch them locally. If it fails on infrastructure (sandbox error, exit 137, no findings), do not push empty commits; report it.
2. Post one follow-up evidence comment on brief PR #62 (head SHA, hash table, rules file, guard output, placeholder grep, Vercel, Ternary).
3. Operator reviews and merges (reserved). After merge, rewrite this file on `main`.

## Blocked

- None. Merge of PR #63 is reserved for the operator.

## Important context

- `main` HEAD at install time: `f2bddce` (Clear example values for Stripe configuration). Recent shipped work on main: `/security` page (GRA-78, PRs #55–#58), marketing agent team (#51–#53), RLS (#49), open signup GRA-68 (#48).
- Another brief (`stale-pr-triage`, PR #61) is open. This workstream is scoped to the Ratchet install only and does not triage those PRs.
- Linear issues for Granted AI now live in team LOO; the in-repo Linear tracking rule still says `GRA-<id>` (`CLAUDE.md` `/start`, `.claude/commands/start.md`). Left unchanged on purpose.
- Review/merge gate is still Codex `/review` (`chatgpt-codex-connector`). Ratchet does not replace it.
- App is OpenAI-only; canonical schema is `shared/schema-simple.ts`; no `api/simple.ts`; OCR not implemented. See the five gotchas at the top of `AGENTS.md`.
- `AGENTS.md` / `CLAUDE.md` still carry `ratchet-version: 1.2.0`; hooks, skills, and `CODEX.md` are 1.3.0. Those two markers were left because those files are project files.
- `.ratchet/guard-destructive.rules` is project-owned MEMORY. `install.sh` / `upgrade.sh` never overwrite it.

## Verification status

- Upgrade source: `/tmp/ratchet-130/drop-in` at `11a02d0dca64c9af6bc11400d693b7cea9a77c03` (Ratchet 1.3.0).
- Second `upgrade.sh` report: `SAME` for every unmodified upstream file; `CURRENT` for `check-on-stop.sh` and `lint-edited-file.sh` (owner fills); `CONFLICT` only on `AGENTS.md` / `CLAUDE.md` (left unresolved); `MEMORY` for `.ratchet/`.
- `sha256sum` MATCH vs 11a02d0 for every installed upstream file except the two owner-filled hooks. Named files `guard-destructive.sh`, `lib-payload.sh`, `source-root.sh`, `upgrade.sh`, `rrr.sh` all MATCH.
- Guard probes (payload files, not typed commands): `npm run db:push` exit 2 (project rule); `npx drizzle-kit generate` exit 2 (project rule); `npm run lint` exit 0.
- `.claude/hooks/test-hooks.sh` 298 passed, 0 failed (stderr: two `jq: Argument list too long` lines in the large-payload case).
- `.agents/skills/ratchet-bugfix/scripts/test-rrr.sh` 36 passed, 0 failed.
- `.agents/skills/ratchet-handoff/scripts/test-runlog.sh` 49 passed, 0 failed.
- `.agents/skills/ratchet-init/scripts/test-source-root.sh` 17 passed, 0 failed.
- Narrowed placeholder grep (exclude `.agents`, `.claude`, `.git`) empty (exit 1).
- `AGENTS.md` / `CLAUDE.md` vs pre-upgrade HEAD: unchanged.
- `npm run lint && npm run check && npm run test:run` exit 0 — 24 files, 181 tests passed (vitest 4.0.18).

## Open risks / assumptions

- Node 22.23.4 / npm 10.9.9 in this environment; CI/preview may differ.
- `npm test` is vitest watch; a future agent that restores the template `CHECKS` will hang the stop hook.
- Ratchet skill and hook files document the template placeholder sentinel (the stop hook greps for it). Seeded `.ratchet/` files and merged `AGENTS.md` / `CLAUDE.md` must not leave that placeholder in a slot.
- Installed `test-install.sh` / `test-upgrade.sh` fail (do not skip) when this repo has no Ratchet drop-in source.

## Integration note

When PR #63 is merged, rewrite this file against `main`: tag the install `[merged #63]`, keep the other open PRs, and set Next to "use Ratchet pickup on the next workstream". Git is the integration mechanism.

## Last handoff

- Updated: 2026-11-05
- By: agent (Cursor Grok 4.6)
- Branch/worktree: cursor/install-ratchet-b7d1
- Last known-good commit: 87948a3c7d8b74f6579f0c081a4d918d5abf883a (Ratchet 1.3.0 re-sync + project rules)
