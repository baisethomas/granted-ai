import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GrantMetric, GrantMetricEvent } from "@/lib/api";
import { formatMetricValue } from "./utils";

interface MetricHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: GrantMetric | null;
  events: GrantMetricEvent[];
  isLoading?: boolean;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Unknown date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPeriod(event: GrantMetricEvent): string | null {
  if (!event.periodStart && !event.periodEnd) return null;
  if (event.periodStart && event.periodEnd) {
    return `${formatDate(event.periodStart)} - ${formatDate(event.periodEnd)}`;
  }
  return event.periodStart
    ? `From ${formatDate(event.periodStart)}`
    : `Through ${formatDate(event.periodEnd)}`;
}

export function MetricHistoryDialog({
  open,
  onOpenChange,
  metric,
  events,
  isLoading,
}: MetricHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Metric history</DialogTitle>
          <DialogDescription>
            {metric ? `Recorded updates for ${metric.label}.` : "Recorded metric updates."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-slate-600">
                No reporting updates have been recorded yet.
              </CardContent>
            </Card>
          ) : (
            events.map(event => (
              <div key={event.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {metric
                        ? formatMetricValue(event.value, metric.type, metric.unit)
                        : event.value}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(event.recordedAt)}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {event.status ?? "recorded"}
                  </Badge>
                </div>
                {formatPeriod(event) ? (
                  <p className="mt-2 text-xs font-medium text-slate-600">
                    Period: {formatPeriod(event)}
                  </p>
                ) : null}
                {event.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{event.note}</p>
                ) : null}
                {event.evidenceUrl ? (
                  <a
                    href={event.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    View evidence
                  </a>
                ) : null}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
