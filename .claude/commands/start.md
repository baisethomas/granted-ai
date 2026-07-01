---
description: Start work on a Linear issue — creates a branch before any code is touched
---

Use this at the beginning of every issue. Never write code before this command completes.

## Steps

1. **Confirm the issue.** Ask the user for the Linear issue ID and title if not provided (e.g., `GRA-42 — Add retry endpoint`).

2. **Check you are on main and it is clean.**
   ```bash
   git branch --show-current   # must be main
   git status                  # must be clean (no uncommitted changes)
   git pull origin main        # pull latest before branching
   ```
   If not on main or tree is dirty, stop and tell the user to resolve that first.

3. **Create and push the branch.**

   Branch naming rules:
   - Feature / new work: `feat/GRA-<id>-<short-slug>`
   - Bug fix: `fix/GRA-<id>-<short-slug>`
   - Maintenance / docs / chores: `chore/<short-slug>`

   Short slug: lowercase, hyphens only, ≤ 5 words (e.g., `add-retry-endpoint`).

   ```bash
   git checkout -b feat/GRA-42-add-retry-endpoint
   git push -u origin HEAD
   ```

4. **Confirm and proceed.** Report the branch name to the user, then begin the work described in the issue.

## Why this matters

Direct commits to main bypass code review and can ship broken or unreviewed code. The branch + PR pattern is the only safe path to production in this repo.
