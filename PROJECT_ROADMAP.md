# Granted AI Delivery Roadmap

This document tracks execution across the phased plan to align the Express + Vite stack with the PRD.

## Phase Status

| Phase | Scope Highlights | Status | Notes |
| --- | --- | --- | --- |
| Phase 1 – Auth & Persistence Foundation | Supabase JWT middleware, API protection, client auth headers, Drizzle wiring, basic auth smoke tests | In Progress | Started Oct 17 2025 |
| Phase 2 – Document Ingestion & Retrieval | Supabase Storage uploads, text extraction + embeddings, async processing, document API polish | Not Started | Pending Phase 1 completion |
| Phase 3 – RAG Core | Retrieval planner, grounded responses with citations/assumptions, response metadata | Not Started | |
| Phase 4 – Clarification & Evidence | Clarification engine endpoints, Evidence Map data, version history selector | Not Started | |
| Phase 5 – Exports & Billing | DOCX/PDF grounding, usage tracking + plan enforcement, billing APIs | Not Started | |
| Phase 6 – QA & Launch | End-to-end tests, perf + security passes, docs & runbooks | Not Started | |

## Current Focus: Phase 1 Tasks

- [x] Enforce Supabase-authenticated requests across protected Express routes.
- [x] Ensure SPA adds Supabase JWT to all API calls (queries, mutations, uploads).
- [x] Provide `/api/auth/me` response sourced from Supabase tokens for client session checks.
- [x] Validate required env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) at startup and document fallback behaviour.
- [x] Confirm Drizzle Postgres path is usable in non-local deployments (env validation, fallback logging).
- [x] Add basic auth/persistence smoke tests (TBD script or integration harness).

_Update this checklist as subtasks complete to keep the team in sync._
