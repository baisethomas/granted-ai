# Granted Design System

Practical reference for UI work in the client app. Source spec: **Granted Design System** (Figma export). Upload flows on `feat/design-system-upload-forms` (PR #4) were the first components aligned to this spec.

## Color tokens

Use these hex values for new Granted-branded UI. Prefer Tailwind arbitrary values (e.g. `text-[#2186EB]`) until tokens are centralized in CSS variables.

| Token | Hex | Usage |
|-------|-----|--------|
| Primary blue | `#2186EB` | Links, active states, icons, drag highlight border |
| Blue tint | `#EAF2FE` | Icon backgrounds, drop zone drag state |
| Text primary | `#0C1B33` | Headings, drop zone title |
| Text secondary | `#56627A` | Body copy, descriptions |
| Text muted | `#8A94A6` | Hints, file-type labels |
| Border default | `#E6E9EF` | Cards, dividers |
| Border dashed | `#C7CFDD` | File upload drop zone (default) |
| Surface subtle | `#FBFBFD` | File upload drop zone background |
| Success green | `#1B8E3E` | Success states |
| Accent amber | `#F2B134` | Highlights, badges |

Existing shadcn/Radix theme variables in `client/src/index.css` (`--primary`, `--border`, etc.) still power most of the app. New upload-related UI should follow the tokens above for consistency with the design system.

## Typography

- **UI text**: Open Sans — set via `--font-sans` in `client/src/index.css` and applied to `body`.
- **Hints / code**: JetBrains Mono in the design spec. The app uses `font-mono` (currently Menlo via `--font-mono`); use `font-mono text-[11px]` for file-type hints to match the File Upload pattern.

## File Upload

Shared component: `client/src/components/ui/file-upload.tsx`

### When to use

| Use `FileUpload` | Build custom instead |
|------------------|----------------------|
| Standard drag-and-drop + click-to-browse upload | Multi-file queue with per-file progress bars |
| Single file per interaction (default) | Upload tied to a non-file control (e.g. paste-only) |
| Toast on success/failure is acceptable | Parent must own all error/success UI (`showToast={false}`) |

**Do not** add a separate "Choose Files" button — the whole drop zone is clickable and supports drag-and-drop.

Current usages: `upload.tsx`, `forms.tsx` (grant form import dialog), `ExtractFromFileDialog.tsx`.

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
