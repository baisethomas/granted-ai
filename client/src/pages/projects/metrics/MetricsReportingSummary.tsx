import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GrantMetric, MetricsResponse } from "@/lib/api";
import { formatMetricValue, progressPct } from "./utils";

interface MetricsReportingSummaryProps {
  metrics: GrantMetric[];
  project: MetricsResponse["project"];
  onRecordUpdate: (metric: GrantMetric) => void;
  onCopyReport: () => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function latestUpdatedAt(metrics: GrantMetric[]): string | null {
  const latest = metrics
    .map(metric => {
      const d = new Date(metric.updatedAt);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    })
    .reduce((max, value) => Math.max(max, value), 0);
  return latest ? new Date(latest).toISOString() : null;
}

export function MetricsReportingSummary({
  metrics,
  project,
  onRecordUpdate,
  onCopyReport,
}: MetricsReportingSummaryProps) {
  const activeMetrics = metrics.filter(m => m.status === "active");
  const metricsMissingValues = activeMetrics.filter(m => !m.value);
  const metricsWithTargets = activeMetrics.filter(m => m.target);
  const metricsAtTarget = metricsWithTargets.filter(m => {
    const pct = progressPct(m.value, m.target);
    return pct !== null && pct >= 100;
  });
  const dueInDays = daysUntil(project.reportingDueAt);
  const latestUpdate = latestUpdatedAt(activeMetrics);

  const needsAttention = [
    ...metricsMissingValues,
    ...metricsWithTargets.filter(m => {
      const pct = progressPct(m.value, m.target);
      return pct !== null && pct < 100;
    }),
  ].filter((metric, index, all) => all.findIndex(m => m.id === metric.id) === index);

  return (
    <Card className="border-slate-200">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Target className="h-4 w-4 text-slate-600" />
              Reporting snapshot
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Current readiness across the metrics funders will ask you to report.
            </p>
          </div>
          <Badge
            variant={metricsMissingValues.length ? "destructive" : "secondary"}
            className="mt-0.5"
          >
            {metricsMissingValues.length
              ? `${metricsMissingValues.length} missing values`
              : "All values recorded"}
          </Badge>
        </div>

        {activeMetrics.length > 0 ? (
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={onCopyReport}>
              <ClipboardCopy className="mr-2 h-4 w-4" />
              Copy report summary
            </Button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <AlertCircle className="h-3.5 w-3.5" />
              Needs values
            </div>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {metricsMissingValues.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Targets met
            </div>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {metricsAtTarget.length}/{metricsWithTargets.length}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" />
              Report due
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(project.reportingDueAt)}
            </p>
            {dueInDays !== null ? (
              <p className="mt-1 text-xs text-slate-500">
                {dueInDays < 0 ? `${Math.abs(dueInDays)} days overdue` : `${dueInDays} days left`}
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Last metric update
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(latestUpdate)}
            </p>
          </div>
        </div>

        {needsAttention.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-slate-900">Needs attention</h4>
            <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {needsAttention.slice(0, 5).map(metric => {
                const pct = progressPct(metric.value, metric.target);
                return (
                  <div
                    key={metric.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{metric.label}</p>
                      <p className="text-xs text-slate-500">
                        {metric.value
                          ? `${formatMetricValue(metric.value, metric.type, metric.unit)} recorded${
                              pct !== null ? `, ${pct}% of target` : ""
                            }`
                          : "No current value recorded"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onRecordUpdate(metric)}>
                      Update
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
