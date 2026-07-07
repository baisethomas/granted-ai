---
description: Run the citation-faithfulness eval — catches fabrication regressions in the generation pipeline before they ship
---

The product's entire value is "drafts you can defend": every claim cited, gaps flagged instead of invented. This command runs a fixed scorecard of grant-question cases through the real generation pipeline and verifies the output with checkers that are **independent** of the pipeline's own grounding code — so a regression in `normalizeGroundedCitations()` or `findUnsupportedSpecifics()` gets caught instead of mirrored.

Run it after **any** change to `server/services/ai.ts` (prompt or code), `retrieval.ts`, generation-adjacent code in `routes.ts`, or before/after changing `GRANTED_DEFAULT_MODEL`. The RAG quality bar in `CLAUDE.md` requires the scorecard in the PR.

## 0. Preconditions

```bash
git branch --show-current        # any branch is fine; note it for the report
npx tsx scripts/rag-eval.ts --dry-run   # checker self-test, no API calls, free
```
If the dry-run fails, the checkers themselves are broken — fix `scripts/rag-eval.ts` before trusting any live result. Do not proceed to a live run on a failing self-test.

## 1. Cost gate

A live run makes one OpenAI call per case (~6 cases) against the developer's own `OPENAI_API_KEY` — roughly **$0.02–0.05 on gpt-4o-mini**. This is dev tooling with no user/org, so the `billingService.checkLimit` rule (which governs user-facing spend) does not apply — but state the cost in your report. If `OPENAI_API_KEY` is missing, report that and stop; do not mock a "pass."

## 2. Run the live eval

```bash
npx tsx scripts/rag-eval.ts
```

What it checks per case (see the script header for detail):
1. Every `[#N]` marker points at a supplied chunk.
2. Every returned citation traces to a supplied chunk, quote verbatim.
3. Every number in the draft exists in the sources, the question, or a flagged assumption.
4. Every proper-noun phrase in the draft exists in the sources or is flagged (the GRA-52 class: sources say "three counties," draft must not name them).
5. Thin-context cases surface assumptions instead of confident specifics.

Exit 0 = no regression vs. `docs/rag-eval-baseline.json`. Exit 1 = regression: a case that passed in baseline now fails, or total failures rose.

## 3. Interpret and act

- **No regression:** paste the case table (✓/✗ per case, failure lines) into your report or PR body. Done.
- **Regression:** the generation change made grounding worse. Fix the pipeline — do not weaken the checkers to make it pass, and do not update the baseline to absorb a real fabrication. Typical causes: prompt edits that softened the grounding contract, changes to `normalizeGroundedCitations`/`findUnsupportedSpecifics`, a model swap.
- **Intentional improvement** (e.g. a new check now flags things the old baseline tolerated, or a stricter prompt fixes an old failure): rerun with `--update-baseline` and commit the updated `docs/rag-eval-baseline.json` in the same PR, explaining why the baseline moved.
- **Flaky single case** (LLM nondeterminism): rerun once. If it flips, note it as flaky in the report; if it fails twice, treat it as real.

## 4. Extending the scorecard

When a fabrication bug ships (like GRA-52), add a case to `CASES` in `scripts/rag-eval.ts` that reproduces it — the eval is a regression suite and should grow one case per incident. New case → run live → `--update-baseline` → commit both together.

## Rules

- Never edit the checkers and the prompt in the same PR without saying so — that's how a regression hides.
- Never delete a failing case to get green.
- The baseline file is code-reviewed like code: a diff that raises `totalFailures` needs a justification in the PR body.
