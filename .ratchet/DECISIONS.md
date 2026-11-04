# Ratchet Decision Ledger

<!--
This is durable project memory: decisions that future agents should not reopen accidentally.

Unlike STATE.md, this file is append-oriented. The agent owns maintaining it. Record durable choices when their rationale would otherwise be lost and future work would be constrained by them.

SAFETY: Never record secrets, credentials, access tokens, personal/customer data, or sensitive security/incident details. Use sanitized references to the approved protected system instead.

GIT INTEGRATION: Parallel branches may add decisions independently. Do not invent live synchronization. At merge/integration, preserve compatible decisions from both sides and explicitly resolve true conflicts. Never silently drop an accepted or proposed decision from another branch.

Use branch-friendly decision IDs so parallel additions do not routinely collide. Preferred format: `D-YYYYMMDD-HHMM-short-slug` using UTC when available (for example `D-20260821-0615-shared-review-core`). If an ID collision still occurs, preserve both entries and rename one during integration; identity is not authority.

Autonomy rule:
- Low-impact implementation choices usually stay in code and do not need an entry.
- Medium-impact durable choices may be decided and recorded by the agent, then surfaced in the completion summary.
- High-impact choices require explicit human approval before they are accepted or executed.

Do not record routine implementation choices that are obvious from the code. Do not silently rewrite prior rationale.
-->

## Decision format

### D-YYYYMMDD-HHMM-short-slug — short decision title

- **Status:** accepted | proposed | superseded
- **Impact:** low | medium | high
- **Date:** YYYY-MM-DD
- **Decision:** one-sentence statement of what was decided
- **Why:** the reason this option won
- **Rejected / alternatives:** what else was live and why it lost
- **Consequences:** what future work must now assume
- **Revisit when:** the condition that would reopen this
- **Approved by:** agent | human name/role

---

## Decisions

<!--
Append durable decisions below.
Medium-impact decisions can be accepted autonomously by the agent when they are reversible and within authorized scope.
High-impact decisions remain proposed until a human approves them.
If an accepted decision changes, mark the old entry superseded and add a new decision that references it.
At branch integration, preserve compatible entries from all sides; escalate materially conflicting accepted decisions instead of choosing silently.
-->

### D-20261104-2145-merge-ratchet-into-existing-docs — Merge Ratchet into existing AGENTS.md and CLAUDE.md

- **Status:** accepted
- **Impact:** medium
- **Date:** 2026-11-04
- **Decision:** Install Ratchet by appending its contract/adapter to the existing `AGENTS.md` and `CLAUDE.md`, never replacing those files. Keep the original CLAUDE.md pointer, five gotchas, never-break product rules, and Linear `/start` (`GRA-` branch naming) verbatim.
- **Why:** The brief required a merge, not a clobber. `install.sh` already skips existing files; the judgement call is how to add the contract. Appending keeps every prior rule load-bearing and still gives agents a Ratchet-aware `AGENTS.md`.
- **Rejected / alternatives:** Sidecar (`AGENTS.ratchet.md`) would split the contract Codex already auto-loads. Replacing the files would drop the Linear tracking rule and product never-break rules. Skip would leave Ratchet unenforced.
- **Consequences:** Agents must read both the original project guide in `CLAUDE.md` and the Ratchet section of `AGENTS.md`. Two Claude model maps now coexist (the older Opus/Sonnet/Haiku session table and the Ratchet Fable/Opus/Sonnet/Haiku delegation table). Codex `/review` remains the merge gate.
- **Revisit when:** Linear team IDs are rewritten in-repo (GRA is retired in Linear in favor of LOO, but the in-repo rule is unchanged), or if a sidecar becomes necessary because the merged file is too long for weak models.
- **Approved by:** agent (authorized by brief PR #62)

### D-20261104-2145-ratchet-check-command — Check command is lint + tsc + vitest run

- **Status:** accepted
- **Impact:** medium
- **Date:** 2026-11-04
- **Decision:** The Ratchet check command is `npm run lint && npm run check && npm run test:run`. The stop hook `CHECKS` array is those three commands. Do not use `npm test` in the stop hook.
- **Why:** `package.json` defines `test` as vitest watch, which would hang a stop gate. `test:run` is the CI-style run. `check` is `tsc`. That trio matches what CLAUDE.md already tells agents to run before a PR.
- **Rejected / alternatives:** Template defaults (`npm run lint --silent` + `npm test --silent`) would hang on watch mode. A `make check` target does not exist.
- **Consequences:** Stop-hook and `ratchet-done` both run the same three scripts. The lint hook keeps the template language rows so `test-hooks.sh` still exercises them; only the ESLint row is used in daily TypeScript/JavaScript work.
- **Revisit when:** a single composite npm script is added, or a GitHub Actions workflow starts running a different set.
- **Approved by:** agent (authorized by brief PR #62)
