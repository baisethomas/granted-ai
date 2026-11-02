# Brief: Triage granted-ai's four stale PRs

**Project:** granted-ai
**Created:** 2026-11-02
**Status:** open

## Task

granted-ai has been idle since late August with four open PRs. Bring each one to a clear decision:
either make it ready to merge or recommend closing it with a reason. Do not change product scope.

- #60 Install Vercel Web Analytics (draft, mergeable): https://github.com/baisethomas/granted-ai/pull/60
- #54 docs: security page plan + code-verified claim audit (draft, mergeable): https://github.com/baisethomas/granted-ai/pull/54
- #50 Sync docs with RLS security fix (conflicting): https://github.com/baisethomas/granted-ai/pull/50
- #45 Route auth emails through branded Resend templates (conflicting): https://github.com/baisethomas/granted-ai/pull/45

## Complete means

- [ ] Every one of the four PRs has a comment that states one of two outcomes: "ready to merge" or "recommend close: <reason>".
- [ ] Every PR marked ready to merge is rebased on current `main`, shows no conflicts, is out of draft, and has passing checks at its latest head SHA.
- [ ] For #60, the Vercel preview deployment of the rebased branch loads, and the analytics script appears in the page source.
- [ ] For #45, the change is described well enough that the operator can test a branded auth email. The comment lists the env vars and Supabase hook settings it needs.

## Evidence required

- One summary comment on this brief PR with a table: PR, outcome, reason, head SHA, CI link.
- For #60, the preview URL and a screenshot of the page source showing the analytics script.
- For #50 and #45, the conflict resolution diff summary: which files, and what was kept.
- For #54, confirmation that every claim in the audit still matches the code on current `main`, or a list of the ones that don't.

## Reserved for the operator

- merge
- deploy (production)
- closing any PR
- changing env vars, Supabase auth hooks, or Resend settings
- send / publish

## Original intake

> Yes.

(In reply to the CoS: "Do you want a granted-ai brief next to triage its four stale PRs?")

## Notes from the CoS

The product is live but has been idle since August. These four PRs are the whole open backlog, and two
have drifted into conflict. Clearing them gives a clean base before any new granted-ai work.
