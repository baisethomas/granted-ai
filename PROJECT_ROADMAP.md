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

## Current Focus: Phase 2 Tasks (In Progress)

- [x] Stream uploads into Supabase Storage and persist document lifecycle metadata.
- [x] Archive raw extraction text and log document processing jobs.
- [x] Implement background worker to chunk text, generate embeddings, and update job/document status.
- [ ] Surface processing status/telemetry in the Upload UI (badges, errors, signed URLs).
- [ ] Enable automated/scheduled worker execution in deployment environments.

_Update this checklist as subtasks complete to keep the team in sync._
