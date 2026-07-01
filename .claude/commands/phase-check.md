---
description: Audit the current phase completion status and surface what's actually done vs what's left
---

Read PROJECT_ROADMAP.md to find the current phase and its checklist.

Then verify each checklist item by reading the actual code — don't trust the checkboxes alone. For each item:

1. Find the relevant file(s)
2. Confirm the implementation exists and is wired up end-to-end (route → service → DB)
3. Note any gaps between what's checked off and what's actually working

Then output:

**Current Phase:** [name]

**Verified complete:**
- [item] → [file:line where it lives]

**Checked but needs verification:**
- [item] → [what's missing or incomplete]

**Not started:**
- [item]

**Recommended next:** [the single highest-value thing to tackle next based on the PRD's success criteria]

Be direct. If something is marked complete but the implementation is a stub, say so.
