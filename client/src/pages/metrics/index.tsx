import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3, FolderOpen, TrendingUp, DollarSign, Clock } from "lucide-react";
import { api, type PortfolioMetricsResponse } from "@/lib/api";

interface PortfolioMetricsPageProps {
  onOpenProject?: (projectId: string) => void;
}

function formatTotal(
  total: number,
  type: string,
  unit: string | null,
): string {
  if (type === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(total);
  }
  if (type === "percent") return `${Math.round(total)}%`;
  const formatted = Math.round(total).toLocaleString("en-US");
  return unit ? `${formatted} ${unit}` : formatted;
}

export default function PortfolioMetricsPage({ onOpenProject }: PortfolioMetricsPageProps) {
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const { data, isLoading, error } = useQuery<PortfolioMetricsResponse>({
    queryKey: ["/api/metrics/portfolio", periodStart, periodEnd],
    queryFn: () => api.getPortfolioMetrics({ periodStart, periodEnd }),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-red-600">
          Failed to load metrics.
        </CardContent>
      </Card>
    );
  }

  const totalsEntries = Object.entries(data.totalsByKey);

  return (
    <div className="space-y-5 md:space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 md:text-2xl">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Portfolio metrics
        </h2>
        <p className="text-slate-600 mt-1">
          Roll-up view of outcomes and progress across all your grants.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid gap-1 sm:w-auto">
            <label htmlFor="portfolio-period-start" className="text-xs font-medium text-slate-600">
              Period start
            </label>
            <Input
              id="portfolio-period-start"
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              className="w-full sm:w-[170px]"
            />
          </div>
          <div className="grid gap-1 sm:w-auto">
            <label htmlFor="portfolio-period-end" className="text-xs font-medium text-slate-600">
              Period end
            </label>
            <Input
              id="portfolio-period-end"
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              className="w-full sm:w-[170px]"
            />
          </div>
          {(periodStart || periodEnd) && (
            <Button
              variant="outline"
              onClick={() => {
                setPeriodStart("");
                setPeriodEnd("");
              }}
            >
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-4">
        <StatsCard
          title="Active projects"
          value={data.stats.activeProjects}
          icon={<FolderOpen className="text-blue-600 h-5 w-5" />}
          iconBgColor="bg-blue-100"
        />
        <StatsCard
          title="Success rate"
          value={data.stats.successRate}
          icon={<TrendingUp className="text-green-600 h-5 w-5" />}
          iconBgColor="bg-green-100"
        />
        <StatsCard
          title="Total awarded"
          value={data.stats.totalAwarded}
          icon={<DollarSign className="text-emerald-600 h-5 w-5" />}
          iconBgColor="bg-emerald-100"
        />
        <StatsCard
          title="Due this week"
          value={data.stats.dueThisWeek}
          icon={<Clock className="text-orange-600 h-5 w-5" />}
          iconBgColor="bg-orange-100"
        />
      </div>

      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg">Aggregate outcomes</CardTitle>
          <p className="text-sm text-slate-600">
            Sums across active metrics your grants have in common.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          {totalsEntries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">
              No outcome metrics recorded yet. Add metrics to a grant to see aggregates here.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {totalsEntries.map(([key, t]) => (
                <div
                  key={key}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <p className="text-xs text-slate-500">{t.label}</p>
                  <p className="text-xl font-semibold text-slate-900 mt-1">
                    {formatTotal(t.total, t.type, t.unit)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    across {t.count} grant{t.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg">Grants at a glance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.projects.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No projects yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.projects.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProject?.(p.id)}
                  className="w-full text-left px-4 py-4 hover:bg-slate-50 transition-colors flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:px-6 md:py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.title}</p>
                    <p className="text-xs text-slate-500 truncate">{p.funder}</p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {p.status}
                    </Badge>
                    {p.amountAwarded != null && (
                      <span className="text-xs text-slate-600">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(p.amountAwarded / 100)}
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {p.metricsTracked} metric{p.metricsTracked === 1 ? "" : "s"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.metricUpdatesInPeriod} update{p.metricUpdatesInPeriod === 1 ? "" : "s"}
                    </span>
                    {p.metricsMissingValues > 0 && (
                      <Badge variant="destructive" className="text-[11px]">
                        {p.metricsMissingValues} missing
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
