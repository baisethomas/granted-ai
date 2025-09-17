
## 1) Executive Summary
Granted is an agentic, model-agnostic web app that ingests an organization's materials (mission, past proposals, budgets, impact reports) and autonomously drafts complete, funder-aligned grant applications with minimal user interaction. It differentiates by combining a persistent organization memory, a clarification engine, rubric-based scoring, and optional grant discovery and tracking.

**MVP Objective:** deliver end-to-end value by enabling a user to upload documents, paste grant questions, generate a complete draft with minimal clarifications, review/modify, and export.

## 2) Success Criteria (MVP)
- **TTFD (time-to-first-draft):** under 10 minutes from first upload.
- **Grounding quality:** ≥ 85% of paragraphs reference at least one uploaded source (measured by Evidence Map).
- **Clarification load:** ≤ 5 clarifying questions for a standard application.
- **Export fidelity:** DOCX/PDF renders cleanly in Word/Preview.
- **Cost per draft:** within target budget envelope set by plan (tracked via token metering).

## 3) Goals and Non‑Goals
### Goals
- Reduce writing effort while improving alignment to funder rubrics.
- Persist organizational memory that improves with each project.
- Support small teams with light collaboration and role-based access.
- Provide predictable costs through plan limits and usage metering.

### Non‑Goals (MVP)
- Automated submission to funder portals.
- Full grant discovery marketplace integration.
- SOC 2 certification (create path only).
- Real-time multi-cursor editing.

## 4) Personas
- **Solo Founder:** minimal time; needs credible first draft quickly.
- **Grant Professional:** high throughput; needs consistency, rubric alignment, exports.
- **Program Director:** reviews drafts; adds context; cares about clarity and outcomes.
- **Executive/Board Reviewer:** skim-level review; wants polished summaries and risks called out.

## 5) Differentiation (Positioning)
- **Agentic flow** over chat snippets: the system plans → retrieves → drafts → validates → asks only essential questions → finalizes.
- **Persistent org intelligence:** living profile tuned by uploads and prior wins.
- **Outcome tools:** rubric scoring, Fundability Gauge, readiness checks.
- **Collaboration & governance:** roles, versioning, approvals (lightweight in MVP).

## 6) Core User Stories & Acceptance Criteria
### US1: Upload organizational materials
- **As a user** I can drag‑drop PDF/DOCX/TXT and have them parsed (incl. OCR for scans).
- **Accepts:**
  - Types: PDF, DOCX, TXT, RTF, MD, CSV (budgets), images (OCR).
  - Max 10MB/file (MVP). Virus scan + progress UI.
  - Parsed preview + quick summary per file.

### US2: Create a grant project and input questions
- **As a user** I can start a project and paste questions or choose a template.
- **Accepts:**
  - Fields: title, funder, due date, rubric toggle.
  - Questions normalized into sections; template library seeded with 3 examples.

### US3: Generate a draft with minimal clarifications
- **As a user** I click “Generate” and receive a complete draft.
- **Accepts:**
  - ≤ 5 targeted clarifying questions when critical facts are missing.
  - Each section includes citation markers and an Evidence Map.
  - Assumptions clearly labeled and easy to resolve.
  - Draft generation ≤ 90 seconds for typical inputs.

### US4: Review, edit, version, and export
- **As a user** I can revise content and export to DOCX/PDF.
- **Accepts:**
  - Version history on each Save.
  - Diff viewer at section level.
  - Exports preserve headings, bullets, simple tables.

### US5: Organizational memory
- **As a user** I see a profile auto-built from my uploads.
- **Accepts:**
  - Mission, beneficiaries, programs, outcomes, metrics, tone.
  - Profile is editable and reusable across projects.

### US6: Basic team access and billing
- **As an admin** I invite users and assign roles.
- **Accepts:**
  - Roles: Admin, Writer, Reviewer.
  - Plan gates (Starter/Pro/Team/Enterprise).
  - Visible usage meter (projects, uploads, AI credits).

## 7) Functional Scope (MVP)
- Auth & org setup, uploads + OCR, parsing + chunking + embeddings.
- Project creation with questions or template.
- Retrieval‑augmented agent: plan → retrieve → compose → validate → clarify → finalize.
- Editor with versioning and export (DOCX/PDF).
- Plan enforcement and basic billing hooks.
- Analytics + error tracking.
"""

part2 = """## 8) Non‑Functional Requirements
- **Availability:** 99.5% monthly.
- **Latency:** initial draft ≤ 90s.
- **Privacy:** encryption at rest/in transit; tenant isolation per org.
- **Scalability:** horizontal API; background workers for long jobs.
- **Cost control:** token metering, per‑plan caps, budget alerts.

## 9) System Architecture
- **Frontend:** Next.js + React + TypeScript; Tailwind or CSS Modules.
- **Backend:** Serverless functions (Vercel) + background workers (Supabase Edge Functions or Cloud Run).
- **Data:** Supabase Postgres for relational; Supabase Storage for files; pgvector for embeddings.
- **LLM Abstraction:** provider‑agnostic client supporting OpenAI/Anthropic/Mistral/local models.
- **Exports:** DOCX via `docx` library; PDF via headless Chromium (html → pdf).

### High‑Level Data Flow
1) Upload → Storage → Virus scan → OCR (if needed) → Text extraction → Chunk + embed → Store vectors.  
2) Create Project → Normalize Questions → Agent planning → Retrieval per section → Draft → Rubric score → Clarify → Save draft → Export.

## 10) Data Model (Initial)
**users**(id, email, name, created_at)  
**organizations**(id, name, created_at, plan, billing_customer_id)  
**memberships**(user_id, org_id, role)  
**projects**(id, org_id, title, funder, due_date, status, created_by)  
**documents**(id, org_id, filename, mime, size, storage_path, ocr, parsed_text_preview)  
**doc_chunks**(id, document_id, chunk_index, content, embedding vector)  
**knowledge_profile**(org_id, mission, beneficiaries, programs, outcomes, metrics, tone, last_refreshed_at)  
**grant_templates**(id, name, description, sections jsonb)  
**questions**(id, project_id, section, prompt_text, ord)  
**drafts**(id, project_id, version, content md, created_by)  
**draft_citations**(draft_id, section, source_document_id, chunk_refs jsonb)  
**clarifications**(id, project_id, question, answer, resolved_at)  
**evaluations**(id, project_id, rubric jsonb, score jsonb)  
**usage_events**(id, org_id, type, tokens_in, tokens_out, cost, project_id, created_at)  
**invites**(id, org_id, email, role, token, accepted_at)  
**subscriptions**(org_id, plan, status, renewal_at, seats, provider_customer_id)

Indexes: pgvector on doc_chunks.embedding; FKs across entities; partial index on usage_events(project_id).

## 11) API Surface (Initial)
- `POST /api/uploads` → document_id  
- `GET /api/documents/:id` → parsed preview  
- `POST /api/projects` → create project  
- `POST /api/projects/:id/questions` → bulk add  
- `POST /api/projects/:id/generate` → start agent job  
- `GET /api/drafts/:id` → draft + citations  
- `POST /api/drafts/:id/export` → docx/pdf  
- `GET /api/usage` → usage meters  
- `POST /api/invites` → invite user  
- `POST /api/billing/checkout` → upgrade plan

## 12) Agent Design & Context Engineering
**Pipelines:**  
- **Summarizer:** extract org facts/metrics/stories; output JSON.  
- **Planner:** build section plan with required facts and source doc IDs.  
- **Retriever:** hybrid (semantic+BM25) per section; cap 2–4 sources/section.  
- **Generator:** compose grounded text; add inline citation markers; tag assumptions.  
- **Clarifier:** ask ≤ 5 crisp questions for missing critical facts.  
- **Rubric Scorer:** 0–5 per criterion with rationale and edit suggestions.

**Guardrails:** Evidence Map per paragraph; refuse to fabricate numbers; tone controls (professional, data‑driven, storytelling).

## 13) Security & Compliance
- JWT auth; role‑based access.  
- Encryption at rest/in transit.  
- Private buckets per org prefix; signed URLs.  
- PII redaction in logs; data retention policy; export/delete my data.  
- SOC 2 path: logging, incident response, least‑privilege, vendor reviews.

## 14) Observability & Analytics
- Error tracking (Sentry), structured logs with correlation IDs.  
- Usage dashboards: uploads, projects, tokens, cost per draft.  
- Synthetic uptime checks and end‑to‑end smoke tests.

## 15) Pricing & Plan Enforcement
- Starter, Pro, Team, Enterprise mapped to feature flags and quotas.  
- Usage Events power metering, alerts, and billing webhooks.

## 16) Project Plan & Timeline (6 weeks)
"""

part3 = """
### Phase Breakdown
- **Week 0:** Tech spikes (OCR, embeddings, DOCX export). Finalize schema. Seed templates.
- **Week 1:** Auth, orgs, uploads, storage, parsing pipeline.
- **Week 2:** Chunking/embeddings, retrieval API, knowledge_profile builder.
- **Week 3:** Projects + questions, agent planner/generator, citations.
- **Week 4:** Clarification loop, rubric scorer, editor + versioning.
- **Week 5:** Exports, billing/usage, analytics, polish & beta hardening.
- **Week 6:** Beta launch window, docs, onboarding content.

## 17) Testing & QA Strategy
- **Unit:** parsers, chunking, retrieval, prompt builders, exporters.  
- **Integration:** end‑to‑end generation with fixtures; export validation.  
- **Red‑team:** conflicting docs, missing budgets, noisy scans.  
- **Performance:** 10 docs / 50MB total uploads within SLA.  
- **Human eval:** 10 pilot users rate clarity, alignment, and effort saved.

## 18) Risks & Mitigations
- **Hallucinations:** enforce Evidence Map; assumption tags; human‑in‑the‑loop.  
- **Noisy inputs:** cleaning pipeline; language detection; chunk normalization.  
- **Token cost creep:** cache embeddings; per‑section context caps; summarization layers.  
- **Security drift:** IaC for policies; regular permission audits; scoped keys.

## 19) Future Roadmap (Post‑MVP)
- Grant discovery + auto‑match; pre‑fill applications.  
- Deeper collaboration (inline comments, assignments, approvals).  
- Executive summary generator; board‑ready briefing packs.  
- Multilingual support; accessibility refinements.  
- Mobile companion for review/approvals.  
- SSO, SCIM, enterprise analytics.

## 20) Open Questions
- Primary LLM/provider at launch?  
- Managed OCR vs. self‑hosted for scale/cost/quality?  
- First‑quarter integrations (Drive, Dropbox, Salesforce)?  
- Which funder templates to prioritize for the library?
"""

full_prd = part1 + "\n" + part2 + "\n" + timeline + "\n" + part3

# Save to markdown
out_path = Path("/mnt/data/granted_prd.md")
out_path.write_text(full_prd)

out_path
