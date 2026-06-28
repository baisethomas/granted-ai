# Granted Design System

Practical reference for UI work in the client app. Source spec: **Granted Design System** (Figma export).

## Color tokens

Use these hex values for new Granted-branded UI. Prefer Tailwind arbitrary values (e.g. `text-[#2186EB]`) until tokens are centralized in CSS variables.

| Token | Hex | Usage |
|-------|-----|--------|
| Primary blue | `#2186EB` | Primary buttons, links, active states, focus rings |
| Primary hover | `#1559C9` | Primary button hover |
| Blue tint | `#EAF2FE` | Ghost button hover, icon backgrounds, drag highlight |
| Text primary | `#0C1B33` | Headings, button labels, input text |
| Text secondary | `#56627A` | Body copy, descriptions |
| Text muted | `#8A94A6` | Hints, placeholders |
| Label text | `#2E3A4F` | Form field labels |
| Border default | `#E6E9EF` | Inputs, cards, outline buttons |
| Border strong | `#C7CFDD` | Outline button hover, dashed zones |
| Surface subtle | `#FBFBFD` | Outline button hover background |
| Disabled fill | `#EEF1F6` | Disabled buttons |
| Disabled text | `#AEB6C4` | Disabled button text |
| Success green | `#1B8E3E` | Success states |
| Accent amber | `#F2B134` | Highlights, badges |

CSS variables in `client/src/index.css` (`--primary`, `--border`, `--ring`) are tuned to `#2186EB` and `#E6E9EF`. Shared shadcn primitives in `client/src/components/ui/` consume these tokens.

## Typography

- **UI text**: Open Sans — set via `--font-sans` in `client/src/index.css` and applied to `body`.
- **Hints / code**: JetBrains Mono in the design spec. Use `font-mono text-[11px]` for file-type hints.

## Buttons

Shared component: `client/src/components/ui/button.tsx`

Pill buttons with ≥44px hit area. Use variants instead of one-off color classes.

| Variant | When to use | Key styles |
|---------|-------------|------------|
| `default` | Primary actions (Save, Submit, Generate) | Fill `#2186EB`, pill radius, soft shadow |
| `outline` | Secondary actions (Cancel, Save draft) | `#E6E9EF` border, hover `#FBFBFD` |
| `ghost` | Tertiary / inline actions | Text `#2186EB`, hover `#EAF2FE` |
| `destructive` | Irreversible deletes | Existing destructive token |
| `link` | Inline text actions | Underlined primary text |

Sizes: `default` (13px/22px padding), `sm`, `lg`, `icon`.

**Do not** override with `bg-primary-600`, `bg-indigo-600`, or `bg-blue-600` — use `<Button>` variants.

### Dialog / form action rows

Use `DialogFooter` with outline for cancel/dismiss and default for the primary action:

```tsx
<DialogFooter>
  <Button variant="outline" onClick={onClose}>Cancel</Button>
  <Button onClick={onSave} disabled={saving}>Save</Button>
</DialogFooter>
```

For full-width mobile stacks, add `className="w-full sm:w-auto"` on individual buttons rather than custom colors.

## Form fields

Shared primitives: `Input`, `Textarea`, `Select`, `Label`, `Checkbox` in `client/src/components/ui/`.

| Element | Style |
|---------|--------|
| Label | 13px semibold `#2E3A4F` |
| Input / textarea / select | 15px text, `#E6E9EF` border (1.5px), 11px radius, min-height 44px |
| Placeholder | `#8A94A6` |
| Focus | Border `#2186EB`, ring `3px rgba(33,134,235,.15)` |
| Checkbox | 22×22px, 7px radius, checked fill `#2186EB` |

Use `<Label htmlFor="…">` with matching `id` on the control. Prefer `FormField` / `FormItem` from `form.tsx` for react-hook-form screens.

## File Upload

See PR #4 (`feat/design-system-upload-forms`) for the aligned drop-zone component. Until merged, the legacy `FileUpload` uses the same button tokens via `<Button>` — do not add a separate "Choose Files" styling override.
