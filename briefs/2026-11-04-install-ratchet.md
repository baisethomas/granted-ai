# Brief: Install Ratchet

**Project:** granted-ai
**Created:** 2026-11-04
**Status:** open

## Task

Install Ratchet in granted-ai using baisethomas/Ratchet's `install.sh` / `drop-in/` templates. The existing AGENTS.md and CLAUDE.md must be merged, not clobbered: keep the Linear tracking rule and all existing project rules. Seed `.ratchet/STATE.md` with the real current state (open PRs, recent work, next step, Last handoff) and no FILL-ME placeholders, and seed `.ratchet/DECISIONS.md` with initial entries if warranted.

## Complete means

- [ ] `.ratchet/STATE.md`, `.ratchet/DECISIONS.md`, `.agents/skills/*` and a Ratchet-aware AGENTS.md exist
- [ ] `grep -rn FILL-ME .` returns nothing
- [ ] Every rule in the previous AGENTS.md and CLAUDE.md (including the Linear tracking rule) is still present
- [ ] The existing tests/build still pass

A duration is not a condition. "Spend two hours on it" is not complete-means.

## Evidence required

- The AGENTS.md and CLAUDE.md diffs against main, showing existing rules preserved
- The `install.sh` command run and its output
- `grep -rn FILL-ME .` output (empty)
- The tests/build output
- PR body in the five sections, Verification split RAN/READ/ASSUMED/INCONCLUSIVE with ASSUMED non-empty

## Ratchet repos

If the repo has `.ratchet/`, follow its AGENTS.md:
- Update `.ratchet/STATE.md`: tag the PR `[open PR #N]` and update Last handoff.
- Append medium-impact decisions to `.ratchet/DECISIONS.md` (append only; supersede, never edit).
- Write the PR body in five sections: What changed / Shape & why / Verification (split RAN / READ / ASSUMED / INCONCLUSIVE; ASSUMED never empty) / Residue / Handoff.
- Bug fixes include the `RRR: PROVEN` line from rrr.sh.
- Any skipped step is written as `skip: <reason>`.
- The Verifier will fail PRs missing these.

## Reserved for the operator

- merge
- deploy
- send / publish
- pay

## Original intake

> "yep roll them out then install Ratchet on the other repos"
>
> (Baise, 2026-11-04, replying to proposals to add Ratchet requirements to briefs, Builder and Verifier; refresh the stale STATE files in sentavrix and Ruach; and install Ratchet on granted-ai and loomlogic-agent-environment.)

## Notes from the CoS

Ratchet is in four repos but not granted-ai. Installing it brings this repo under the same STATE/DECISIONS handoff discipline. Another brief PR is open here; keep this one scoped to the Ratchet install.
