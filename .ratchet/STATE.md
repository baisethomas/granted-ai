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

Re-synced installed Ratchet files on `cursor/install-ratchet-b7d1` (work PR #63) to Ratchet 1.3.1 at main squash `efb2dc70b61a79f912ef36aac5c8ce3ca4372b96`. Project rules file unchanged. Waiting on Vercel and Ternary on the new head. Do not merge.

## Completed

- Ran `install.sh --from <Ratchet>/drop-in --to <repo> --claude --codex` on 2026-11-04: added `.ratchet/`, `.agents/skills/`, hooks, `CODEX.md`, and `.claude/skills` symlink; skipped existing `AGENTS.md` and `CLAUDE.md`.
- Appended the filled Ratchet contract to `AGENTS.md` and the Claude adapter to `CLAUDE.md` without deleting prior rules.
- Wired `.claude/settings.json` hooks. Stop-hook `CHECKS` is lint + tsc + `test:run`.
- Opened work PR #63 off `main`.
- Re-synced to 1.2.1 (`770fc5d`), then 1.3.0 (`11a02d0`) with `.ratchet/guard-destructive.rules` for `npm run db:push` / `drizzle-kit generate`. See D-20261105-0125.
- Re-synced to 1.3.1 (`efb2dc7`) via `upgrade.sh --from /tmp/ratchet-131/drop-in --to <repo> --installed-version 1.3.0`. Applied every MERGE except `AGENTS.md` / `CLAUDE.md`. Left the project rules file untouched. See D-20261105-0322.

## Working on

- Ratchet install for granted-ai [open PR #63]
- brief: install-ratchet [open PR #62]
- brief: stale-pr-triage [open PR #61]
- Install Vercel Web Analytics [open PR #60]
- docs: security page plan + code-verified claim audit [open PR #54] (draft in `gh pr list --state open`)
- Sync docs with RLS security fix (PR #49) [open PR #50]
- Route auth emails through branded Resend templates [open PR #45]

## Next

1. Wait for Vercel and Ternary on the 1.3.1 head. If Ternary flags unmodified upstream files, stop and report — do not patch them. If it fails on infrastructure, do not push empty commits; report it.
2. Post one evidence comment on brief PR #62 (head SHA, hash table, rules file, guard output, placeholder grep, Vercel, Ternary).
3. Operator reviews and merges (reserved). After merge, rewrite this file on `main`.

## Blocked

- None. Merge of PR #63 is reserved for the operator.

## Important context

- `main` HEAD at install time: `f2bddce`. This workstream does not triage the other open PRs.
- Linear issues live in team LOO; in-repo tracking still says `GRA-<id>`. Left unchanged.
- Review/merge gate is still Codex `/review`. Ratchet does not replace it.
- `AGENTS.md` / `CLAUDE.md` still carry `ratchet-version: 1.2.0`; hooks, skills, and `CODEX.md` are 1.3.1.
- `.ratchet/guard-destructive.rules` is project-owned MEMORY and was not rewritten in this pass.

## Verification status

- Upgrade source: `/tmp/ratchet-131/drop-in` at `efb2dc70b61a79f912ef36aac5c8ce3ca4372b96` (Ratchet 1.3.1).
- Second `upgrade.sh` report: `SAME` for every unmodified upstream file; `CURRENT` for `check-on-stop.sh` and `lint-edited-file.sh`; `CONFLICT` only on `AGENTS.md` / `CLAUDE.md` (left unresolved); `MEMORY` for `.ratchet/` including the rules file.
- `sha256sum` MATCH vs efb2dc7 for every installed upstream file except the two owner-filled hooks. Named files `guard-destructive.sh`, `lib-payload.sh`, `source-root.sh`, `upgrade.sh`, `rrr.sh`, `runlog.sh` all MATCH.
- Guard probes: schema-push script exit 2 (project rule); kit generate exit 2 (project rule); lint exit 0.
- `.claude/hooks/test-hooks.sh` 298 passed, 0 failed (stderr: two `jq: Argument list too long` lines).
- `.agents/skills/ratchet-bugfix/scripts/test-rrr.sh` 40 passed, 0 failed.
- `.agents/skills/ratchet-handoff/scripts/test-runlog.sh` 65 passed, 0 failed.
- Narrowed placeholder grep (exclude `.agents`, `.claude`, `.git`) empty (exit 1).
- `AGENTS.md` / `CLAUDE.md` / `.ratchet/guard-destructive.rules` vs pre-upgrade HEAD: unchanged.
- `npm run lint && npm run check && npm run test:run` exit 0 — 24 files, 181 tests passed.

## Open risks / assumptions

- Node 22.23.4 / npm 10.9.9 in this environment; CI/preview may differ.
- `npm test` is vitest watch; restoring the template `CHECKS` would hang the stop hook.
- Installed `test-install.sh` / `test-upgrade.sh` fail (do not skip) when this repo has no Ratchet drop-in source.
- Ternary still reviews vendored files (the skip is not deployed). 1.3.1 is expected to clear `runlog.sh:122` and `rrr.sh:140`; any new finding is reported, not patched downstream.

## Integration note

When PR #63 is merged, rewrite this file against `main`: tag the install `[merged #63]`, keep the other open PRs, and set Next to "use Ratchet pickup on the next workstream". Git is the integration mechanism.

## Last handoff

- Updated: 2026-11-05
- By: agent (Cursor Grok 4.6)
- Branch/worktree: cursor/install-ratchet-b7d1
- Last known-good commit: 80b64747258d8b9ac21926f59648f60fa4238119 (Ratchet 1.3.1 re-sync)
