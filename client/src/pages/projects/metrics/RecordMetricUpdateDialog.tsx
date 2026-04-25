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
import type { GrantMetric } from "@/lib/api";
import { formatMetricValue } from "./utils";

interface RecordMetricUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: GrantMetric | null;
  onSubmit: (payload: { value: string; note?: string | null }) => Promise<unknown> | unknown;
}

function inputTypeFor(metric: GrantMetric | null): string {
  if (!metric) return "text";
  if (metric.type === "date") return "date";
  if (metric.type === "number" || metric.type === "currency" || metric.type === "percent") {
    return "number";
  }
  return "text";
}

export function RecordMetricUpdateDialog({
  open,
  onOpenChange,
  metric,
  onSubmit,
}: RecordMetricUpdateDialogProps) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(metric?.value ?? "");
    setNote("");
  }, [open, metric]);

  const handleSave = async () => {
    if (!metric || !value.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        value: value.trim(),
        note: note.trim() ? note.trim() : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const targetLabel =
    metric?.target ? formatMetricValue(metric.target, metric.type, metric.unit) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record update</DialogTitle>
          <DialogDescription>
            {metric
              ? `Update the reported value for ${metric.label}.`
              : "Update this metric."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="metric-update-value">
              {targetLabel ? `Value toward ${targetLabel}` : "Value"}
            </Label>
            <Input
              id="metric-update-value"
              type={inputTypeFor(metric)}
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={metric?.type === "date" ? "YYYY-MM-DD" : "Enter value"}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="metric-update-note">Reporting note</Label>
            <Textarea
              id="metric-update-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What changed, what period this covers, or what evidence supports it?"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !metric || !value.trim()}>
            {saving ? "Recording..." : "Record update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
