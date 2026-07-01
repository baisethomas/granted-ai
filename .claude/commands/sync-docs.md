---
description: Reconcile all documentation (and the Notion knowledgebase) with the current state of the code
---

Invoke the doc-keeper agent to reconcile documentation with reality.

Scope: look at what has changed recently (uncommitted changes, and commits since the last doc sync if determinable). Then:

1. Update `CLAUDE.md` (canonical) — file paths, data flow, endpoints, schema table list, env vars, commands, and the "Reality vs. the docs" section.
2. Check `.claude/agents/*.md` and `AGENTS.md` still point at real files/tables.
3. Update `README.md`, `PROJECT_ROADMAP.md`, and any reference doc the change touched.
4. Archive any doc that has become a point-in-time snapshot (move to `docs/archive/`, add a row to its README).
5. Produce the Notion knowledgebase update per the doc-keeper's Notion section.

Verify every claim against the code before writing it. Code is the source of truth. End with a short changelog of what docs changed and why, and output the Notion update block (or apply it, depending on the configured Notion mechanism).
