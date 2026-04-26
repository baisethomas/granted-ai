import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Upload } from "lucide-react";
import type { MetricSuggestion } from "@/lib/api";
import { CATEGORY_LABELS } from "./utils";
import { useToast } from "@/hooks/use-toast";

interface ExtractFromFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtract: (file: File) => Promise<{ suggestions: MetricSuggestion[] }>;
  onAccept: (suggestions: MetricSuggestion[]) => Promise<unknown>;
}

export function ExtractFromFileDialog({
  open,
  onOpenChange,
  onExtract,
  onAccept,
}: ExtractFromFileDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<MetricSuggestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSuggestions(null);
    setSelected(new Set());
    setFile(null);
  };

  const handleFile = async (picked: File) => {
    setFile(picked);
    setExtracting(true);
    setSuggestions(null);
    setSelected(new Set());
    try {
      const res = await onExtract(picked);
      setSuggestions(res.suggestions);
      setSelected(new Set(res.suggestions.map(s => s.key)));
      if (res.suggestions.length === 0) {
        toast({
          title: "No metrics found",
          description: "We couldn't identify specific metrics in this document.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Extraction failed",
        description: err?.message ?? "Unable to extract metrics from this file.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleAccept = async () => {
    if (!suggestions) return;
    const picked = suggestions.filter(s => selected.has(s.key));
    if (picked.length === 0) {
      onOpenChange(false);
      reset();
      return;
    }
    setSaving(true);
    try {
      await onAccept(picked);
      toast({
        title: "Metrics added",
        description: `${picked.length} metric${picked.length === 1 ? "" : "s"} saved to this grant.`,
      });
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast({
        title: "Failed to save",
        description: err?.message ?? "Unable to save metrics.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            Extract metrics from grant application
          </DialogTitle>
          <DialogDescription>
            Upload the RFP / funder guidelines and we'll suggest metrics to track.
            You can edit or add more after accepting.
          </DialogDescription>
        </DialogHeader>

        {!suggestions && (
          <div className="py-6 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <Upload className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="text-sm text-slate-600 text-center px-4">
              {extracting
                ? `Reading ${file?.name ?? "document"}…`
                : "PDF, DOCX, or TXT up to 10 MB"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={extracting}
            >
              {extracting ? "Extracting…" : "Choose file"}
            </Button>
          </div>
        )}

        {suggestions && suggestions.length > 0 && (
          <div className="max-h-[420px] overflow-y-auto space-y-2 py-1">
            {suggestions.map(s => {
              const isChecked = selected.has(s.key);
              return (
                <label
                  key={s.key}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${
                    isChecked ? "border-indigo-300 bg-indigo-50/40" : "border-slate-200"
                  }`}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={isChecked}
                    onCheckedChange={next => {
                      setSelected(prev => {
                        const copy = new Set(prev);
                        if (next) copy.add(s.key);
                        else copy.delete(s.key);
                        return copy;
                      });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{s.label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[s.category]}
                      </Badge>
                      {s.target && (
                        <Badge variant="outline" className="text-[10px]">
                          target {s.target}
                          {s.unit ? ` ${s.unit}` : ""}
                        </Badge>
                      )}
                      <span className="text-[10px] text-slate-500 sm:ml-auto">
                        {s.confidence}% confidence
                      </span>
                    </div>
                    {s.rationale && (
                      <p className="text-xs text-slate-600 mt-1">{s.rationale}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {suggestions && suggestions.length === 0 && (
          <div className="py-6 text-center text-sm text-slate-500">
            No metrics were identified in this document.
          </div>
        )}

        <DialogFooter>
          {suggestions && (
            <Button variant="ghost" onClick={reset} disabled={saving}>
              Try another file
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!suggestions || selected.size === 0 || saving}
          >
            {saving ? "Saving…" : `Add ${selected.size || ""} metric${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
