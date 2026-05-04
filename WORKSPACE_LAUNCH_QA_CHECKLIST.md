# Workspace migration and switching — manual QA checklist

Use this checklist before launch whenever multi-workspace behavior or `migrations/0009_client_workspaces.sql` changes. Record **PASS / FAIL**, **environment** (local / staging / prod), **date**, and **tester initials** on a copy or in Linear.

Companion automation: Vitest **`server/routes.workspace.test.ts`** (workspace isolation, billing usage ACL, deletes). Run:

```bash
npm run test:run -- server/routes.workspace.test.ts
```

---

## 0. Prerequisites

- [ ] Database migrated through **`0009_client_workspaces.sql`** (and subsequent migrations) on the target environment.
- [ ] **`npm run dev`** (or staging URL), valid **Supabase** auth, **`DATABASE_URL`** and AI keys configured (see **ENVIRONMENT_SETUP.md**).
- [ ] Stripe / billing vars only if validating checkout (**BILLING_SYSTEM.md**).

---

## 1. Existing account migration (legacy users)

Legacy data assumes a **default workspace** whose `organizations.id` matches the **`users.id`** for that account (see backfill section in **`migrations/0009_client_workspaces.sql`**: projects/documents missing `organization_id` are patched to `user_id`).

- [ ] Log in as an account that existed **before** workspace migration was applied.
- [ ] Sidebar workspace selector lists at least one workspace; **`My Organization`** (or prior org name from user profile) is present.
- [ ] **Dashboard** shows expected project count; projects open without error.
- [ ] **Uploads** lists documents previously tied to this user; summaries/processing statuses look intact.
- [ ] **Forms / Drafts** can load existing projects and questions.
- [ ] *(Optional DB spot-check)* For the test user, `organizations.id = users.id` for the migrated default row and memberships link `user_id` to that organization.

---

## 2. New workspace creation

- [ ] Open sidebar → **Create client workspace**, submit a uniquely named workspace.
- [ ] Active workspace switches to the new organization (TanStack caches should target the new id).
- [ ] **`localStorage`** key **`granted.activeOrganizationId`** updates to the new organization id after creation (browser devtools).
- [ ] New workspace starts with **no** projects/uploads from other workspaces until you create them here.

---

## 3. Workspace switching and cache isolation

Use **two** workspaces **A** and **B**. Create identifiable fixture data only in **A** (named project title, uniquely named uploaded file stub or document name).

- [ ] With **A** active: dashboard project list shows **A**’s fixtures; note titles/ids.
- [ ] Switch to **B**: dashboard **does not** show **A**’s-exclusive projects.
- [ ] Switch back to **A**: **A**’s fixtures reappear (**no bleed**).
- [ ] Reload the page on **A**, then switch to **B** and reload again — persistence via **`granted.activeOrganizationId`** behaves correctly.

---

## 4. Primary flows — verify **per workspace** (repeat on A vs B where applicable)

| Area | Steps | Done |
| --- | --- | --- |
| **Dashboard** | Project list + aggregate stats (`/api/organizations/:id/stats`) match selected workspace only. | [ ] |
| **Upload** | Upload workspace-wide (`Workspace memory`). Optionally choose a grant; row shows Grant vs Workspace-wide badges. Confirm doc only scopes to intended grant at generation time. Other workspace unchanged. | [ ] |
| **Forms** | Create/select project scoped to workspace; submit or save without cross-workspace leakage. | [ ] |
| **Drafts / generation** | Run generation for workspace **A**; switch to **B** — drafts/questions for **A** not shown as **B**’s data (project picker only lists **B**’s projects). | [ ] |
| **Portfolio metrics** | Metrics overview lists projects only from active workspace; date filters behave normally. | [ ] |
| **Organization** | Profile fields (`mission`, contact fields, etc.) save per workspace; reviewing profile suggestions scopes to active org. | [ ] |
| **Settings → usage** | **UsageDashboard** reflects **`GET /api/organizations/:id/billing/usage`** for active org id; totals change when switching orgs after usage-producing actions. | [ ] |
| **Billing / pricing** | If Stripe is enabled: from **pricing** (`/pricing`), **Try Pro** starts checkout (`POST /api/billing/checkout`); completing or canceling returns to app cleanly. Returning user still sees workspace-scoped usage in settings. *(Skip if Stripe not wired in env.)* | [ ] |

---

## 5. Exports

On an active workspace with at least one generated draft:

- [ ] PDF export produces usable output.
- [ ] DOCX opens cleanly where applicable (see **EXPORT_FUNCTIONALITY.md**).
- [ ] Clipboard/copy preserves readable structure.

---

## 6. Regression and security negatives

- [ ] Automated suite: `npm run test:run -- server/routes.workspace.test.ts` **green**.
- [ ] Opening a deep link / project drill-in: if project belongs to another workspace, UX should not show it as selectable (guard in project detail matches active `organizationId`).

---

## 7. Acceptance matrix (maps to Linear GRA-33)

| Acceptance criterion | Section |
| --- | --- |
| Existing account migration verified | §1 |
| New workspace creation verified | §2 |
| Switching, upload, projects, generation, exports, stats, billing per workspace | §3–§5 |

Issue: [GRA-33](https://linear.app/loomlogiclabs/issue/GRA-33/manual-qa-workspace-switching-and-migration-checklist).
