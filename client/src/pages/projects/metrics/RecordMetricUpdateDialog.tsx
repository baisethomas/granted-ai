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
import type { GrantMetric, RecordMetricEventPayload } from "@/lib/api";
import { formatMetricValue } from "./utils";

interface RecordMetricUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: GrantMetric | null;
  onSubmit: (payload: RecordMetricEventPayload) => Promise<unknown> | unknown;
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
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [status, setStatus] = useState<RecordMetricEventPayload["status"]>("recorded");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValue(metric?.value ?? "");
    setNote("");
    setPeriodStart("");
    setPeriodEnd("");
    setEvidenceUrl("");
    setStatus("recorded");
  }, [open, metric]);

  const handleSave = async () => {
    if (!metric || !value.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        value: value.trim(),
        note: note.trim() ? note.trim() : null,
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        evidenceUrl: evidenceUrl.trim() ? evidenceUrl.trim() : null,
        status,
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="metric-period-start">Period start</Label>
              <Input
                id="metric-period-start"
                type="date"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="metric-period-end">Period end</Label>
              <Input
                id="metric-period-end"
                type="date"
                value={periodEnd}
                onChange={e => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="metric-evidence-url">Evidence URL</Label>
            <Input
              id="metric-evidence-url"
              type="url"
              value={evidenceUrl}
              onChange={e => setEvidenceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={v => setStatus(v as RecordMetricEventPayload["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recorded">Recorded</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
              </SelectContent>
            </Select>
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
