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

Ratchet install on `cursor/install-ratchet-b7d1`. Files are in place; first push will mint the work PR number, then this file is updated with `[open PR #N]`.

## Completed

- Ran `install.sh --from <Ratchet>/drop-in --to <repo> --claude --codex` on 2026-11-04: added `.ratchet/`, `.agents/skills/`, hooks, `CODEX.md`, and `.claude/skills` symlink; skipped existing `AGENTS.md` and `CLAUDE.md`.
- Appended the filled Ratchet contract to `AGENTS.md` and the Claude adapter to `CLAUDE.md` without deleting prior rules.
- Wired `.claude/settings.json` hooks (lint, stop gate, destructive guard). Stop-hook `CHECKS` is lint + tsc + `test:run`.
- Recorded install decisions in `DECISIONS.md`.

## Working on

- Ratchet install for granted-ai (this branch; PR number pending first push)
- brief: install-ratchet [open PR #62]
- brief: stale-pr-triage [open PR #61]
- Install Vercel Web Analytics [open PR #60]
- docs: security page plan + code-verified claim audit [open PR #54] (draft in `gh pr list --state open`)
- Sync docs with RLS security fix (PR #49) [open PR #50]
- Route auth emails through branded Resend templates [open PR #45]

## Next

1. Push this branch, open the work PR, then replace "PR number pending first push" with `[open PR #N]`.
2. Post the evidence table on brief PR #62 (install command/output, diffs, grep, tests/build, five-section PR body).
3. Wait for Ternary review and Vercel preview; do not merge.

## Blocked

- None. Merge of this PR is reserved for the operator.

## Important context

- `main` HEAD at install time: `f2bddce` (Clear example values for Stripe configuration). Recent shipped work on main: `/security` page (GRA-78, PRs #55–#58), marketing agent team (#51–#53), RLS (#49), open signup GRA-68 (#48).
- Another brief (`stale-pr-triage`, PR #61) is open. This workstream is scoped to the Ratchet install only and does not triage those PRs.
- Linear issues for Granted AI now live in team LOO; the in-repo Linear tracking rule still says `GRA-<id>` (`CLAUDE.md` `/start`, `.claude/commands/start.md`). Left unchanged on purpose.
- Review/merge gate is still Codex `/review` (`chatgpt-codex-connector`). Ratchet does not replace it.
- App is OpenAI-only; canonical schema is `shared/schema-simple.ts`; no `api/simple.ts`; OCR not implemented. See the five gotchas at the top of `AGENTS.md`.

## Verification status

- `install.sh --from /tmp/ratchet-src/drop-in --to /agent/repos/granted-ai --claude --codex` exited 0 (27 added, 2 skipped). Source: `/tmp/ratchet-src/drop-in`.
- `npm run lint` exit 0.
- `npm run check` (tsc) exit 0.
- `npm run test:run` exit 0 — 24 files, 181 tests passed (vitest 4.0.18).
- `npm run build` exit 0 (vite + esbuild).
- `.claude/hooks/test-hooks.sh` 258 passed, 0 failed (stderr: two `jq: Argument list too long` lines in the large-payload case).
- `.agents/skills/ratchet-bugfix/scripts/test-rrr.sh` 34 passed, 0 failed.
- `AGENTS.md` / `CLAUDE.md` vs `origin/main`: prefix-identical; additions only. Linear `feat/GRA-<id>` rule still in `CLAUDE.md`.
- Seeded `.ratchet/` files, `AGENTS.md`, `CLAUDE.md`, and `CODEX.md` have no template-placeholder slots. Ratchet skill/hook files still document that sentinel by design.

## Open risks / assumptions

- Node 22.23.4 / npm 10.9.9 in this environment; CI/preview may differ.
- `npm test` is vitest watch; a future agent that restores the template `CHECKS` will hang the stop hook.
- Ratchet skill and hook files document the template placeholder sentinel (the stop hook greps for it). Seeded `.ratchet/` files and merged `AGENTS.md` / `CLAUDE.md` must not leave that placeholder in a slot.

## Integration note

When this branch is merged, rewrite this file against `main`: tag the install PR `[merged #N]`, keep the other open PRs, and set Next to "use Ratchet pickup on the next workstream". Git is the integration mechanism.

## Last handoff

- Updated: 2026-11-04
- By: agent (Cursor Grok)
- Branch/worktree: cursor/install-ratchet-b7d1
- Last known-good commit: pending first commit on this branch
