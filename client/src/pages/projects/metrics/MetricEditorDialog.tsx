import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type GrantMetric,
  type MetricCategory,
  type MetricPreset,
  type MetricType,
} from "@/lib/api";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./utils";

interface MetricEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  metric?: GrantMetric | null;
  presets: MetricPreset[];
  onSubmit: (payload: {
    presetKey?: string;
    key: string;
    label: string;
    type: MetricType;
    category: MetricCategory;
    unit?: string | null;
    value?: string | null;
    target?: string | null;
  }) => Promise<unknown> | unknown;
}

const TYPE_OPTIONS: MetricType[] = ["number", "currency", "percent", "text", "date"];

const TYPE_LABELS: Record<MetricType, string> = {
  number: "Number",
  currency: "Currency ($)",
  percent: "Percent (%)",
  text: "Text",
  date: "Date",
};

interface FormState {
  presetKey: string;
  key: string;
  label: string;
  type: MetricType;
  category: MetricCategory;
  unit: string;
  value: string;
  target: string;
}

function toKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function MetricEditorDialog({
  open,
  onOpenChange,
  mode,
  metric,
  presets,
  onSubmit,
}: MetricEditorDialogProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    presetKey: "",
    key: "",
    label: "",
    type: "number",
    category: "custom",
    unit: "",
    value: "",
    target: "",
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && metric) {
      setForm({
        presetKey: "",
        key: metric.key,
        label: metric.label,
        type: metric.type,
        category: metric.category,
        unit: metric.unit ?? "",
        value: metric.value ?? "",
        target: metric.target ?? "",
      });
    } else {
      setForm({
        presetKey: "",
        key: "",
        label: "",
        type: "number",
        category: "custom",
        unit: "",
        value: "",
        target: "",
      });
    }
  }, [open, mode, metric]);

  const handlePreset = (key: string) => {
    const preset = presets.find(p => p.key === key);
    if (!preset) return;
    setForm(f => ({
      ...f,
      presetKey: preset.key,
      key: preset.key,
      label: preset.label,
      type: preset.type,
      category: preset.category,
      unit: preset.unit ?? "",
    }));
  };

  const handleLabelChange = (label: string) => {
    setForm(f => ({
      ...f,
      label,
      key: f.key && mode === "edit" ? f.key : toKey(label),
    }));
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        presetKey: form.presetKey || undefined,
        key: form.key || toKey(form.label),
        label: form.label.trim(),
        type: form.type,
        category: form.category,
        unit: form.unit ? form.unit.trim() : null,
        value: form.value ? form.value.trim() : null,
        target: form.target ? form.target.trim() : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit metric" : "Add metric"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the value, target, or metadata for this metric."
              : "Pick a preset or create a custom metric to track for this grant."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {mode === "create" && presets.length > 0 && (
            <div className="grid gap-2">
              <Label>Start from a preset</Label>
              <Select
                value={form.presetKey}
                onValueChange={handlePreset}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a preset (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(p => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label} · {CATEGORY_LABELS[p.category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="metric-label">Label</Label>
            <Input
              id="metric-label"
              value={form.label}
              onChange={e => handleLabelChange(e.target.value)}
              placeholder="People served, Amount awarded, Milestone 1…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as MetricType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v as MetricCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map(c => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="metric-value">Current value</Label>
              <Input
                id="metric-value"
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "date" ? "YYYY-MM-DD" : "—"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="metric-target">Target</Label>
              <Input
                id="metric-target"
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="metric-unit">Unit</Label>
              <Input
                id="metric-unit"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="people, hours…"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.label.trim()}>
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Add metric"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
