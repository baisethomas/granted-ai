# Granted Design System

Practical reference for UI work in the client app. Source spec: **Granted Design System** (Figma export).

## Color tokens

Use these hex values for reference. Prefer Tailwind semantic classes that consume CSS variables (e.g. `text-primary`, `bg-primary`, `border-border`) so color updates stay in one place. Use arbitrary hex values only when a token is not yet mapped to a CSS variable.

| Token | Hex | Usage |
|-------|-----|--------|
| Primary blue | `#2186EB` | Primary buttons, links, active states, focus rings, drag highlight |
| Primary hover | `#1559C9` | Primary button hover |
| Blue tint | `#EAF2FE` | Ghost button hover, icon backgrounds, drop zone drag state |
| Text primary | `#0C1B33` | Headings, button labels, input text, drop zone title |
| Text secondary | `#56627A` | Body copy, descriptions |
| Text muted | `#8A94A6` | Hints, placeholders, file-type labels |
| Label text | `#2E3A4F` | Form field labels |
| Border default | `#E6E9EF` | Inputs, cards, outline buttons, dividers |
| Border strong | `#C7CFDD` | Outline button hover, dashed upload zones |
| Surface subtle | `#FBFBFD` | Outline button hover background, drop zone background |
| Disabled fill | `#EEF1F6` | Disabled buttons |
| Disabled text | `#AEB6C4` | Disabled button text |
| Success green | `#1B8E3E` | Success states |
| Accent amber | `#F2B134` | Highlights, badges |

CSS variables in `client/src/index.css` (`--primary`, `--border`, `--ring`) are tuned to `#2186EB` and `#E6E9EF`. Shared shadcn primitives in `client/src/components/ui/` consume these tokens.

## Typography

- **UI text**: Open Sans — set via `--font-sans` in `client/src/index.css` and applied to `body`.
- **Hints / code**: JetBrains Mono in the design spec. The app uses `font-mono` (currently Menlo via `--font-mono`); use `font-mono text-[11px]` for file-type hints to match the File Upload pattern.

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

Sizes: `default` (13px/22px padding), `sm`, `lg`, `icon`. Compact overrides (`h-auto`, `h-8`, `h-7`) work via fixed `h-*` size variants.

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

Shared component: `client/src/components/ui/file-upload.tsx`

### When to use

| Use `FileUpload` | Build custom instead |
|------------------|----------------------|
| Standard drag-and-drop + click-to-browse upload | Multi-file queue with per-file progress bars |
| Single file per interaction (default) | Upload tied to a non-file control (e.g. paste-only) |
| Toast on success/failure is acceptable | Parent must own all error/success UI (`showToast={false}`) |

**Do not** add a separate "Choose Files" button — the whole drop zone is clickable and supports drag-and-drop.

Current usages: `upload.tsx`, `projects/QuestionsPanel.tsx` (grant form import dialog), `projects/metrics/ExtractFromFileDialog.tsx`.

### Visual spec (implemented)

| Element | Style |
|---------|--------|
| Drop zone (default) | 2px dashed `#C7CFDD`, background `#FBFBFD`, 14px radius |
| Drop zone (dragging) | Border `#2186EB`, background `#EAF2FE`, title "Release to upload" |
| Icon container | 52×52px, 14px radius, `#EAF2FE` background, Upload icon `#2186EB` |
| Title | 16px bold `#0C1B33` — default "Drag & drop files here" |
| Description | 14px `#56627A`; "browse files" in `#2186EB` semibold |
| File types hint | Mono 11px `#8A94A6` — e.g. `PDF · DOC · DOCX · TXT — up to 10 MB each` |

Server upload limit is **10 MB** (`server/routes.ts` multer config). Keep `fileTypesHint` in sync with `accept` and the backend limit.

### Props

```tsx
interface FileUploadProps {
  onUpload: (file: File, category?: string) => Promise<void>;
  accept?: string;           // default: ".pdf,.doc,.docx,.txt"
  multiple?: boolean;        // default: false (only first file is processed)
  category?: string;         // passed through to onUpload
  title?: string;            // default: "Drag & drop files here"
  description?: ReactNode;   // default includes blue "browse files" link styling
  fileTypesHint?: string;    // default: "PDF · DOC · DOCX · TXT — up to 10 MB each"
  showToast?: boolean;       // default: true; set false when parent handles feedback
  disabled?: boolean;
  className?: string;
}
```

### Example

```tsx
import { FileUpload } from "@/components/ui/file-upload";

<FileUpload
  onUpload={async (file) => {
    await uploadDocument(file);
  }}
  accept=".pdf,.doc,.docx"
  showToast={false}
  description={
    <>
      Upload your grant application form — or{" "}
      <span className="font-semibold text-[#2186EB]">browse files</span>
    </>
  }
  fileTypesHint="PDF · DOC · DOCX — up to 10 MB each"
/>
```

### Customizing copy

Override `description` and `fileTypesHint` per screen; keep the "browse files" span styled with `font-semibold text-[#2186EB]` so it matches the design system. Use `showToast={false}` when the page or dialog already shows upload progress or errors.
