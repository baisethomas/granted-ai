import { type ReactNode } from "react";
import { Label } from "@/components/ui/label";

// One consistent row: label + description on the left, control on the right.
export function SettingsRow({
  title,
  description,
  htmlFor,
  children,
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-sm font-medium text-slate-900">
          {title}
        </Label>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// Variant for wide controls (sliders, chip groups) that need the full row width.
export function SettingsRowStacked({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="py-4">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-6 first:pt-2">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      <div className="mt-2 divide-y divide-slate-100">{children}</div>
    </section>
  );
}
