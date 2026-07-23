# /campaign — plan and build a marketing campaign

Launch the marketing agent team on a campaign goal.

Usage: `/campaign <goal>` — e.g. `/campaign launch push for open signup, 2 weeks, LinkedIn + email`

## Steps

1. **Brief first.** Invoke the **campaign-strategist** agent with the user's goal (`$ARGUMENTS`). It produces a campaign brief: goal, audience segment, core angle, channel plan, content calendar, success metrics — written to `marketing/campaigns/<campaign-slug>/brief.md`.
2. **Get approval.** Present the brief to the user. Do not build any assets until they approve or amend it.
3. **Execute via specialists.** After approval, the strategist delegates:
   - **market-researcher** — sourced intelligence briefs (commissioned before the brief if the landscape is unclear)
   - **social-media-manager** — LinkedIn/X posts, threads, newsletter drafts
   - **content-generator** — blog posts, guides, case studies, landing copy
   - **ad-copywriter** — paid ad variant sets per platform
   - **visual-producer** — images via `npm run marketing:image` for any asset with an image brief
   Run independent asset builds in parallel where possible.
4. **Voice check.** Run the assembled copy past **brand-voice** before final delivery.
5. **Deliver the package.** Everything lands under `marketing/campaigns/<campaign-slug>/` (copy, calendars, ads) and `marketing/assets/<campaign-slug>/` (images). Summarize what was produced, where it lives, and what the user needs to do to publish (posting is manual unless they ask to send email via Resend).

If `$ARGUMENTS` is empty, ask the user for the campaign goal, timeframe, and channels before invoking the strategist.
