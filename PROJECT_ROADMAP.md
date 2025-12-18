# Granted AI Delivery Roadmap

This document tracks execution across the phased plan to align the Express + Vite stack with the PRD.

## Phase Status

| Phase | Scope Highlights | Status | Notes |
| --- | --- | --- | --- |
| Phase 1 – Auth & Persistence Foundation | Supabase JWT middleware, API protection, client auth headers, Drizzle wiring, basic auth smoke tests | ✅ Completed | |
| Phase 2 – Document Ingestion & Retrieval | Supabase Storage uploads, text extraction + embeddings, async processing, document API polish | ✅ Completed | |
| Phase 3 – RAG Core | Retrieval planner, grounded responses with citations/assumptions, response metadata | In Progress | Started Oct 19 2025 |
| Phase 4 – Clarification & Evidence | Clarification engine endpoints, Evidence Map data, version history selector | Not Started | |
| Phase 5 – Exports & Billing | DOCX/PDF grounding, usage tracking + plan enforcement, billing APIs | Not Started | |
| Phase 6 – QA & Launch | End-to-end tests, perf + security passes, docs & runbooks | Not Started | |

## Current Focus: Phase 3 Tasks (In Progress)

- [x] Build retrieval service (semantic + keyword) over `doc_chunks` with metadata.
- [x] Implement planner + generation pipeline that produces grounded answers with citations and assumption tags.
- [x] Persist citation references and assumption records; expose via Draft UI.
- [x] Integrate updated generator into `/api/questions/:id/generate` with version snapshots.
- [x] Add clarifier stub to log missing context for future Phase 4 work.

_Update this checklist as subtasks complete to keep the team in sync._
