# AGENTS.md

**The canonical project guide is [`CLAUDE.md`](./CLAUDE.md) at the repo root.** Read it first — it has the current architecture, the rules, and a "Reality vs. the docs" section. This file exists so tools that look for `AGENTS.md` (e.g. Codex) find the pointer; it is intentionally not a second copy, to avoid the two-files-drift problem.

## The five things most likely to mislead you

1. **There is no `api/simple.ts`.** The RAG pipeline lives in `server/services/` (`ai.ts`, `retrieval.ts`, `embedding.ts`). `api/` contains only `server.ts`.
2. **The app is OpenAI-only.** "Model-agnostic / Anthropic / Mistral" language in `PRD.md` is aspirational. The `@anthropic-ai/sdk` dep is unused.
3. **OCR is not implemented.** Only text-based PDF extraction (`unpdf`).
4. **Canonical DB schema is `shared/schema-simple.ts`.** `shared/schema.ts` is dead — don't edit it. There is no `drafts` table (answers live in `response_versions`); no `clarifications` table yet (Phase 4).
5. **Every LLM call needs a plan check first:** `billingService.checkLimit(userId, "ai_tokens", estimatedTokens, organizationId)`.

For everything else — data flow, endpoints, commands, env vars, brand voice — see `CLAUDE.md` and `.claude/agents/`.
