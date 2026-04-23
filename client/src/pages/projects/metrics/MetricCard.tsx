import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Sparkles, Check, X } from "lucide-react";
import type { GrantMetric } from "@/lib/api";
import { formatMetricValue, progressPct } from "./utils";

interface MetricCardProps {
  metric: GrantMetric;
  onEdit: (metric: GrantMetric) => void;
  onDelete: (metric: GrantMetric) => void;
  onAccept?: (metric: GrantMetric) => void;
  onDismiss?: (metric: GrantMetric) => void;
}

export function MetricCard({
  metric,
  onEdit,
  onDelete,
  onAccept,
  onDismiss,
}: MetricCardProps) {
  const pct = progressPct(metric.value, metric.target);
  const valueLabel = formatMetricValue(metric.value, metric.type, metric.unit);
  const targetLabel = metric.target
    ? formatMetricValue(metric.target, metric.type, metric.unit)
    : null;
  const isSuggested = metric.status === "suggested";

  return (
    <Card className={`h-full ${isSuggested ? "border-dashed border-indigo-300 bg-indigo-50/40" : ""}`}>
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium text-slate-900 truncate">{metric.label}</h4>
              {metric.source === "ai_suggested" && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" /> AI
                </Badge>
              )}
              {isSuggested && (
                <Badge variant="outline" className="text-indigo-700 border-indigo-300">
                  Suggested
                </Badge>
              )}
            </div>
            {metric.rationale && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{metric.rationale}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(metric)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={() => onDelete(metric)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-slate-900">{valueLabel}</span>
          {targetLabel && (
            <span className="text-xs text-slate-500">of {targetLabel}</span>
          )}
        </div>

        {pct !== null && (
          <div>
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{pct}% of target</p>
          </div>
        )}

        {isSuggested && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-7"
              onClick={() => onAccept?.(metric)}
            >
              <Check className="mr-1 h-3 w-3" /> Accept
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-slate-500"
              onClick={() => onDismiss?.(metric)}
            >
              <X className="mr-1 h-3 w-3" /> Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
