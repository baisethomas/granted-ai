# Archived documentation — historical, do NOT trust as current state

These files are point-in-time snapshots and superseded plans kept only for history. They describe the codebase as it was (mostly the pre-February-2026 refactor era) and contain claims that are **no longer true** — most notably references to `api/simple.ts`, which was refactored into `server/services/`.

**Do not use anything in this folder to make decisions about the current codebase.**

The authoritative sources of truth are:
- **`CLAUDE.md`** (repo root) — current architecture, rules, and reality-vs-docs notes
- **`shared/schema-simple.ts`** — the database schema
- The code itself

If you need the information one of these archived docs covered, verify it against the code and write a fresh doc in the repo root or `docs/`.

## What's here and why it was archived

| File | Why archived |
|---|---|
| `REFACTORING_COMPLETE.md` | Snapshot of a Feb 2026 refactor; falsely claims it updated CLAUDE.md |
| `REFACTORING_SUMMARY.md` | Same refactor, summary form — point-in-time |
| `IMPLEMENTATION_SUMMARY.md` | "Complete ✅" snapshot of data-persistence work |
| `SECURITY_AUDIT.md` | Audits `api/simple.ts`, a file that no longer exists |
| `CREATE_TABLES.md` | One-time "URGENT: create tables" task; tables now exist in the schema |
| `DATA_PERSISTENCE_PLAN.md` | A plan since implemented; superseded by the code |
| `INTEGRATION_PLAN.md` | A plan since implemented; superseded by the code |
| `replit.md` | Artifact from the project's Replit origin |
