---
description: Plan a new feature end-to-end before writing any code
---

Given the feature request, produce a build plan by reading the existing codebase first.

**Step 1 — PRD check**
Does this feature exist in PRD.md? Which user story does it serve? Which phase does it belong to?

**Step 2 — Schema impact**
Does this need new tables or columns? If yes, describe the change to `schema-simple.ts` and any new indexes needed.

**Step 3 — Backend**
What new routes or services are needed? Where in `routes.ts` do they live? What does the service layer look like?

**Step 4 — RAG impact (if any)**
Does this touch the generation pipeline in `server/services/ai.ts` (or `retrieval.ts` / `embedding.ts` / the document worker)? How? Remember: generation is per-question (`/api/questions/:id/generate`), OpenAI-only, and every LLM call needs a `billingService.checkLimit(..., "ai_tokens", ...)` gate first.

**Step 5 — Frontend**
What new pages, components, or hooks are needed? What existing components can be reused?

**Step 6 — Model assignment**
| Subtask | Model | Reason |

**Step 7 — Build order**
Numbered sequence. Schema first, then backend, then frontend. Never build UI before the API it depends on.

**Step 8 — Definition of done**
How do we know this works? What does a successful manual test look like?

Output the plan. Do not write any code until the plan is confirmed.
