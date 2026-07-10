# Dashboard & Flow Redesign — Implementation Plan

Status: **Complete — all 4 phases shipped.** Tracked in Linear under the "Dashboard & flow redesign" milestone (GRA-55, closed — see linked sub-issues GRA-56, GRA-57, GRA-60, GRA-59). This doc was the handoff spec for whoever picked up each phase; each phase shipped as its own branch/PR through the normal `/review` gate.

## Problem

Granted's primary nav is organized around the app's internal pipeline (Upload → Grant Forms → Drafts) instead of around the user's actual object: **one grant application**. A first-time user's mental model is "I have the Ford Foundation application due October 1" — one object, a deadline, a sense of how done it is. Every tool this audience already uses (Asana, Trello, Canva, TurboTax, and direct competitors Grantable/Instrumentl) puts that object at the center and folds process steps inside it. Granted inverts this, which is why the app feels foreign on first use even though component quality and visual styling are fine.

Full research (current-state audit with screenshots, comparable-product analysis, Mobbin-validated pattern evidence) lives in the analysis artifact from 2026-07-08 — ask in `#eng` if you need the link. This doc extracts the actionable plan.

## Target information architecture

```
Today (7 nav items, 3 of them pipeline stages)     Target (4 places)
─────────────────────────────────────────────      ─────────────────────────────────
Dashboard                                           Home         (was Dashboard)
Organization                                        Documents    (was Upload — now an action, not a destination)
Upload            ┐ pipeline stages promoted          — Questions and Drafts move INSIDE
Grant Forms        ├ to permanent nav                    the application workspace
Drafts             ┘                                Metrics      (unchanged)
Metrics                                              Settings    (Organization profile moves here)
Settings
```

The application (today's "project") becomes a workspace with its own stage header: **Set up → Questions → Drafts → Review → Export**. Grant Forms and Drafts stop being global destinations and become tabs scoped to one application — no more re-selecting "which project?" three separate times per session.

Rename surface language "project" → "application" (the user's word). Keep `projects` as the DB table/schema name — this is a copy and component-prop change, not a schema change.

## Phased build order

Each phase is a separate branch/PR. Do not combine phases — the point of phasing is that each one is independently reviewable and shippable.

---

### Phase 1 — Copy, honest status, nav cleanup ✅ Shipped (GRA-56, #25)

No structural change. No schema change. Safe to ship alone.

**Files:**
- `client/src/pages/dashboard.tsx`
- `client/src/components/layout/sidebar.tsx`
- `client/src/components/layout/main-header.tsx`
- `client/src/pages/upload.tsx`
- `client/src/pages/drafts.tsx`
- `client/src/components/ui/project-card.tsx`

**Tasks:**
1. **One CTA name.** Today the same action is called "New Project" (header), "New Grant Application" (dashboard page), and "Create Project" (empty state) — three names for one action across `dashboard.tsx` and the inline creator in `forms.tsx`. Pick **"New application"** and use it everywhere, including button labels and dialog titles.
2. **Kill banned copy.** `upload.tsx` currently reads "build context for AI-powered grant writing"; `drafts.tsx` reads "your AI-generated grant responses." Both violate the brand rule (CLAUDE.md Mistake 16 — never "AI-powered" in UI copy). Rewrite per the copy rules: what happened + what to do next, active voice, no hype. Run `/copy-review` on both files before opening the PR.
3. **Collapse the double header.** The dashboard currently renders two headers stacked ("Dashboard / Welcome to your grant writing workspace" from `main-header.tsx`, then "My Organization / Your grant applications, soonest deadline first" from `dashboard.tsx`). Merge into one.
4. **Move workspace admin off the first-run path.** `sidebar.tsx` renders "Create client workspace" and a red "Delete selected workspace" button directly under the org switcher, visible on every load including a brand-new account with nothing in it. Move both into a menu on the switcher (e.g. a dropdown triggered from the switcher itself), keep the delete action behind its existing confirm dialog.
5. **Derive card status from real data, not the lifecycle enum.** `project-card.tsx` shows a `statusColors`/`statusLabels` badge sourced from `project.status` (draft/submitted/awarded/declined) — a brand-new project with zero questions shows "Draft Review," which reads as progress that hasn't happened. Compute a display status from actual question/answer counts instead: `Setting up` (no questions yet) → `Drafting N/M` (some questions, not all answered) → `Ready to review` (all answered) → fall through to the real lifecycle status once the user has explicitly marked Submitted/Awarded/Declined. This needs a per-project question count + answered count, which the existing `GET /api/projects/:id` / questions endpoints already support — check `client/src/lib/api.ts` for the current shape before adding a new call; prefer extending an existing query over adding a new round-trip per card.

**Acceptance criteria:**
- Grep the client for `AI-powered` and `AI-generated` — zero matches in user-facing strings.
- One button label string ("New application") used in all three creation entry points.
- Fresh account (no projects) shows no destructive action above the fold.
- `npm run lint`, `npm run check`, `npm run test:run` green.

---

### Phase 2 — Application workspace ✅ Shipped (GRA-57, #26)

Structural, client-only. Merges `forms.tsx` and `drafts.tsx` content into the project detail page as tabs, instead of standalone nav destinations that force a re-pick of "which project."

**Files:**
- `client/src/pages/projects/[id].tsx` — currently has `Questions` and `Drafts` tabs that are dead-end stubs pointing the user back to global nav (see lines ~153–167 as of this writing: "Use the Grant Forms tab to manage questions" / "Use the Drafts tab to review generated responses"). Replace those stubs with the real content.
- `client/src/pages/forms.tsx` — question-creation/management logic is already project-scoped once you remove its own "Select Project" dropdown (`forms.tsx:571` area) and instead receive `projectId` as a prop from the parent workspace. Relocate this logic into a component consumed by `[id].tsx`'s Questions tab; don't rewrite the underlying mutations/queries.
- `client/src/pages/drafts.tsx` — same relocation pattern: strip the `selectedProject` state/dropdown (currently `drafts.tsx:108` and the picker around line 809), receive `projectId` as a prop, mount inside `[id].tsx`'s Drafts tab.
- `client/src/components/layout/sidebar.tsx` — remove "Upload," "Grant Forms," "Drafts" from `mainNavItems`; add "Documents" (renamed from Upload — becomes a document-library destination, with upload as an in-page action, not the page's whole purpose).
- `client/src/App.tsx` — `renderActiveView()` switch loses the `forms` / `drafts` cases; `Upload` becomes `Documents`.

**Tasks:**
1. Extract the question-list/question-editor UI out of `forms.tsx` into a component that takes `projectId` as a prop (no internal project picker).
2. Extract the draft-review/export UI out of `drafts.tsx` the same way.
3. Wire both into `[id].tsx`'s `Questions` and `Drafts` `TabsContent` blocks, replacing the current stub text.
4. Add a stage-progress header to `[id].tsx` above the tabs: `Set up → Questions → Drafts → Review → Export`, each segment showing done/current/pending state (see the archetype reference below for the visual pattern — status chips, not a literal progress bar).
5. Delete the now-orphaned standalone `Upload`/`Forms`/`Drafts` nav entries; keep the route/page files if other code still imports pieces of them (check with a repo-wide grep before deleting files outright — `forms.tsx` and `drafts.tsx` have colocated test files: `use-forms-data.ts`, `use-drafts-data.ts`, `DraftStatusBadge.test.tsx`, `citation-display.test.ts`, `utils.test.ts` — these move with the logic, not left behind).
6. Rebuild "Documents" as a document-library page (list + upload action), reusing `upload.tsx`'s existing upload/dropzone component rather than rewriting it.

**Acceptance criteria:**
- From the dashboard, opening an application and adding a question never requires re-selecting the application.
- No route/tab in the app says "go to a different tab to do this" (grep for "Use the" stub strings — should be zero).
- All colocated tests for moved logic (`DraftStatusBadge.test.tsx`, `citation-display.test.ts`, `utils.test.ts` under `pages/drafts/` and `pages/upload/`) still pass after the move — they test logic, not location, so this should be a relocation, not a rewrite.
- `npm run lint`, `npm run check`, `npm run test:run` green.

---

### Phase 3 — Real routes ✅ Shipped (GRA-60, #28)

Client-only. Replaces `activeTab` React state (`App.tsx`) with real `wouter` routes, so back/refresh/bookmarks work. `wouter` is already a dependency and already used for the public marketing pages (`/pricing`, `/privacy`, `/terms`) — this phase extends the same pattern to the authenticated app shell, which currently manages navigation entirely via `useState` instead.

**Files:**
- `client/src/App.tsx` — the `activeTab`/`selectedProjectId` state and `renderActiveView()` switch become `wouter` `<Route>` definitions.
- `client/src/components/layout/sidebar.tsx` — nav items become `<Link>`s (or navigate via `useLocation`) instead of calling `onTabChange`.
- `client/src/pages/projects/[id].tsx` — becomes route-aware: `/app/applications/:id` and `/app/applications/:id/:tab` (tab = overview/questions/drafts/metrics), reading the active tab from the URL param instead of local `useState`.

**Tasks:**
1. Define routes: `/app` (home), `/app/documents`, `/app/metrics`, `/app/settings`, `/app/applications/:id`, `/app/applications/:id/:tab`.
2. Replace `setActiveTab`/`setSelectedProjectId` call sites with `setLocation` (wouter) calls to the corresponding path.
3. `[id].tsx`'s `Tabs value={activeTab}` should read/write the `:tab` URL param instead of local state — `onValueChange` navigates instead of setting state.
4. Confirm the existing auth-redirect logic in `App.tsx` (`PUBLIC_PATHS`, the `/app` redirect effects) still works against the new nested routes — this logic currently assumes `location` is only ever `/`, `/auth`, `/app`, or one of the three public paths; it needs to tolerate `/app/applications/:id/...` too.

**Acceptance criteria:**
- Opening an application, clicking Drafts, then hitting browser Back returns to the application's previous tab (not out of the app).
- Refreshing on `/app/applications/:id/drafts` lands back on the same tab, not the dashboard.
- A direct link to `/app/applications/:id/questions` opens correctly for a logged-in user.
- `npm run lint`, `npm run check`, `npm run test:run` green.

---

### Phase 4 — Home intelligence ✅ Shipped (GRA-59, #30)

Shipped client-only — no new backend endpoints were needed; the checklist and "up next" suggestion are plain logic over data the dashboard already fetches (`client/src/lib/home-guidance.ts`). Replaced the deleted `onboarding-dialog.tsx` tour modal with `HomeGuidance.tsx` — see `CLAUDE.md`'s Client navigation section for the current behavior. Went through 4 Codex review rounds, each catching a real terminal-project-status or loading-race bug — see the PR #30 commit history for specifics.

**Tasks:**
1. **Setup checklist replaces the tour modal.** `client/src/components/onboarding-dialog.tsx`'s 5-screen modal (localStorage flag `granted:onboarding:v1`) is replaced by a persistent checklist card on the Home page: upload documents → add questions → generate first draft. Each row is a verb-labeled deep link (not a description) directly into the relevant workspace action. **As shipped:** no per-step persistence flag at all — each step's done/not-done state is derived fresh on every render from the documents/questions the dashboard already fetches (`computeChecklistProgress` in `client/src/lib/home-guidance.ts`), so it can't drift out of sync with reality. The only localStorage key involved (`granted.lastOpenedProjectId`) is unrelated to checklist progress — it only powers the separate "Continue" row (Task 3).
2. **"Up next" computation.** A single computed suggestion surfaced prominently on Home, across all of the user's applications: no documents uploaded → prompt upload; an application has no questions → prompt adding them; an application has unanswered questions → prompt generating; all answered → prompt review. This is plain client-side logic over data already fetched for the dashboard's project list — no new backend work expected unless per-project question/answer counts aren't already available in bulk (reuse whatever Phase 1's card-status work already pulled).
3. **"Pick up where you left off."** Once at least one application exists, Home's top section shows the most recently touched application with a direct continue action, ahead of the full list.

**Acceptance criteria:**
- A brand-new account sees the 3-step checklist, not the modal; completing all 3 steps updates the checklist to a completed/collapsed state without deleting the user's context of what they did.
- Returning to Home mid-application shows a specific, actionable next step referencing the real application by name — never a generic "get started" message once data exists.
- `npm run lint`, `npm run check`, `npm run test:run` green.

## Pattern references (validated against Mobbin, 2026-07-08)

- Setup checklist as a persistent card that collapses to a progress pill rather than disappearing — see Deel and HoneyBook home screens.
- Checklist rows are verb-labeled deep links, not descriptions — HoneyBook.
- Exactly one saturated primary CTA per screen — Canva ("Create a design").
- Card anatomy = status chip + progress + due date, nothing else — Asana portfolio list.
- Applicant-facing guided flow: always-visible progress %, safe exit/autosave, review-with-per-item-edit before final submit — Indeed's job-application flow.
- Completion states name the artifact produced ("Application exported — YouthLiteracy-Ford.docx"), not a generic success toast — PandaDoc.

## Out of scope for this initiative

- Any schema change. Question/answer counts needed for status derivation should come from existing endpoints; if they genuinely don't exist yet, that's a small additive query in `storage.ts`, not a new table.
- Board/calendar views of applications (Grantable has these) — worth considering later, not part of this plan.
- The Phase 4 clarification engine (roadmap Phase 4, unrelated numbering coincidence) — the "Up next" slot in this plan is a natural landing zone for it later, but building it is out of scope here.

## Workflow reminder

Each phase: `/start` with its Linear issue ID → implement → `npm run lint && npm run check && npm run test:run` → `/pr` → `/review` (Codex gate, loops until clean, auto-merges). Never combine phases into one PR. All 4 phases have shipped and each has had its `/sync-docs` pass — `CLAUDE.md`'s Architecture section describes the real `wouter` routes, the application workspace's stage header, and `HomeGuidance`'s setup checklist / "up next" card on Home; its file structure section and `README.md`'s project structure tree reflect the `forms.tsx`/`drafts.tsx` → `QuestionsPanel.tsx`/`DraftsPanel.tsx` merge. This initiative (GRA-55) is complete — no phases remain.
