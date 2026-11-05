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

### D-20261104-2156-guard-db-push — Guard npm run db:push and drizzle-kit generate

- **Status:** accepted
- **Impact:** medium
- **Date:** 2026-11-04
- **Decision:** Extend the installed destructive-command guard so `npm run db:push` and `npx drizzle-kit generate` are blocked, matching this repo's real schema-mutation commands and the hard stop in `AGENTS.md`.
- **Why:** The drop-in guard blocked `db:migrate` and `drizzle-kit push` but not the `db:push` script this repo actually runs. Codex P1 on PR #63 showed a payload with `npm run db:push` exiting 0. That is the ordinary path to mutate production schema.
- **Rejected / alternatives:** Leave the template patterns unchanged (the command this repo uses would silently pass). Upstream a Ratchet change first (out of scope for this install; this repo still needs the gate now).
- **Consequences:** Claude Code cannot run `npm run db:push` or `drizzle-kit generate` by momentum; a human must run them. `rrr.sh` concurrent-run P2 on the same review was left alone (upstream template, not this repo's mutation path).
- **Revisit when:** Ratchet's drop-in guard gains `db:push` / `generate` itself, or this repo adds another schema-mutation script.
- **Approved by:** agent (authorized by brief PR #62; responding to Codex P1 on PR #63)

### D-20261104-2326-resync-ratchet-1.2.1 — Re-sync installed Ratchet files to 1.2.1 (770fc5d)

- **Status:** accepted
- **Impact:** medium
- **Date:** 2026-11-04
- **Decision:** Bring the installed upstream Ratchet files on PR #63 to Ratchet 1.2.1 at main squash `770fc5d8c40fdbc56af5f99ec0e7c82a20b54091`. Leave `AGENTS.md` and `CLAUDE.md` content unchanged (including the `ratchet-version: 1.2.0` markers). Restore `guard-destructive.sh` to upstream 770fc5d byte-for-byte, dropping the local `db:push` / `drizzle-kit generate` fork from D-20261104-2156-guard-db-push. This entry supersedes that decision; the earlier entry is left as written (append-only).
- **Why:** CoS lifted the hold after Ratchet PR #20 merged. 1.2.1 fails closed on unexpected `payload_field` status and names a missing `lib-payload.sh`, and it fixes the ratchet-init / ratchet-upgrade source-root traversal Ternary flagged. The same instruction required those four scripts to match 770fc5d exactly, so a three-way MERGE that kept the db:push fork was refused for the guard.
- **Rejected / alternatives:** Apply the MERGE proposal for `guard-destructive.sh` (would keep db:push patterns and fail the byte-for-byte check). Patch `AGENTS.md` / `CLAUDE.md` version comments to 1.2.1 (forbidden: those are project files). Keep the local db:push tests in `test-hooks.sh` (they would fail against the restored guard).
- **Consequences:** `npm run db:push` and `npx drizzle-kit generate` are no longer blocked by the installed guard; `drizzle-kit push` and `db:migrate` still are. Installed `test-install.sh` / `test-upgrade.sh` fail (do not skip) when this repo has no Ratchet drop-in source. `AGENTS.md` still reads `ratchet-version: 1.2.0` while hooks/skills are 1.2.1.
- **Revisit when:** a later Ratchet release covers `db:push` / `generate`, or the operator allows updating the version markers in `AGENTS.md` / `CLAUDE.md`.
- **Approved by:** agent (authorized by CoS re-sync of brief PR #62 / work PR #63)

### D-20261105-0125-restore-db-push-via-project-rules — Restore db:push / generate block via project rules

- **Status:** accepted
- **Impact:** medium
- **Date:** 2026-11-05
- **Decision:** Bring the installed upstream Ratchet files on PR #63 to Ratchet 1.3.0 at main squash `11a02d0dca64c9af6bc11400d693b7cea9a77c03`. Keep every installed upstream file byte-identical to that drop-in, including `guard-destructive.sh` (no local fork). Restore the `npm run db:push` and `drizzle-kit generate` block as a PROJECT rule in `.ratchet/guard-destructive.rules`, using the 1.3.0 documented format. This entry supersedes D-20261104-2326-resync-ratchet-1.2.1; the earlier entry is left as written (append-only).
- **Why:** 1.3.0 adds project-owned extra guard rules so a repo can block extra commands without forking the hook. D-20261104-2326 dropped the local fork to satisfy the 1.2.1 byte-for-byte check; the block is still required because `npm run db:push` is this repo's real schema-mutation path. The documented example at 11a02d0 is exactly these two patterns.
- **Rejected / alternatives:** Re-fork `guard-destructive.sh` (fails the 11a02d0 byte-identical requirement). Leave the block dropped (the command this repo uses would silently pass). Patch `AGENTS.md` / `CLAUDE.md` version comments to 1.3.0 (forbidden: those are project files).
- **Consequences:** `npm run db:push` and `npx drizzle-kit generate` are blocked again, via `.ratchet/guard-destructive.rules`, not a hook fork. Defaults still block `drizzle-kit push` and `db:migrate`. `install.sh` / `upgrade.sh` classify the rules file as MEMORY and never overwrite it. `AGENTS.md` / `CLAUDE.md` still read `ratchet-version: 1.2.0` while hooks/skills/`CODEX.md` are 1.3.0. Stop-hook `CHECKS` and the lint-hook comment stay as owner edits (`CURRENT`).
- **Revisit when:** Ratchet's default guard gains `db:push` / `generate` itself, or this repo adds another schema-mutation script, or the operator allows updating the version markers in `AGENTS.md` / `CLAUDE.md`.
- **Approved by:** agent (authorized by brief PR #62 / work PR #63 re-sync to 11a02d0)
