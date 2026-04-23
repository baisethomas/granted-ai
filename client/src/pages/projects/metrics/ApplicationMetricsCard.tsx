import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, FileText, Quote, AlertTriangle, Clock } from "lucide-react";
import type { ApplicationMetrics } from "@/lib/api";

interface ApplicationMetricsCardProps {
  data: ApplicationMetrics;
}

export function ApplicationMetricsCard({ data }: ApplicationMetricsCardProps) {
  const stats = [
    {
      label: "Questions complete",
      value: `${data.questionsAnswered}/${data.questionsTotal}`,
      icon: <FileText className="h-4 w-4 text-blue-600" />,
      bg: "bg-blue-50",
    },
    {
      label: "Citations",
      value: String(data.citationsCount),
      icon: <Quote className="h-4 w-4 text-emerald-600" />,
      bg: "bg-emerald-50",
    },
    {
      label: "Open assumptions",
      value: String(data.unresolvedAssumptions),
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
      bg: "bg-amber-50",
    },
    {
      label: "Days to deadline",
      value:
        data.daysToDeadline === null
          ? "—"
          : data.daysToDeadline < 0
            ? `${Math.abs(data.daysToDeadline)}d overdue`
            : `${data.daysToDeadline}d`,
      icon: <Clock className="h-4 w-4 text-orange-600" />,
      bg: "bg-orange-50",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
          Application progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-slate-600">Completion</span>
            <span className="text-sm font-semibold text-slate-900">{data.completionPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100 mt-1.5">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${data.completionPct}%` }}
            />
          </div>
        </div>

        {data.wordLimitUtilization !== null && (
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-600">Word-limit utilization</span>
              <span className="text-sm font-semibold text-slate-900">
                {Math.round(data.wordLimitUtilization * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 mt-1.5">
              <div
                className="h-full rounded-full bg-slate-400 transition-all"
                style={{ width: `${Math.round(data.wordLimitUtilization * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {stats.map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${s.bg}`}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">{s.label}</p>
                <p className="text-sm font-semibold text-slate-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
