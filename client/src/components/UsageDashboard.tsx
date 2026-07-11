import { useEffect, useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  DollarSign,
  FileText,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { UsageStats, UsageTracker } from "@/lib/usage-tracking";

interface UsageDashboardProps {
  organizationId?: string | null;
  className?: string;
}

export function UsageDashboard({ organizationId, className = "" }: UsageDashboardProps) {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsageStats = async () => {
      if (!organizationId) {
        setUsageStats(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const stats = await UsageTracker.getUsageStats(organizationId);
      setUsageStats(stats);
      setLoading(false);
    };

    fetchUsageStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUsageStats, 30000);
    return () => clearInterval(interval);
  }, [organizationId]);

  if (loading) {
    return (
      <div className={`animate-pulse space-y-4 ${className}`}>
        <div className="h-4 w-1/2 rounded bg-slate-200"></div>
        <div className="h-20 rounded bg-slate-200"></div>
      </div>
    );
  }

  if (!usageStats) {
    return (
      <div className={`py-8 text-center ${className}`}>
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-slate-400" />
        <p className="text-slate-600">Usage statistics aren't available right now. Refresh to try again.</p>
      </div>
    );
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-200 bg-red-50 text-red-800';
      case 'medium': return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'low': return 'border-blue-200 bg-blue-50 text-blue-800';
      default: return 'border-slate-200 bg-slate-50 text-slate-800';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Alerts */}
      {usageStats.alerts.length > 0 && (
        <div className="space-y-3">
          {usageStats.alerts.map((alert, index) => (
            <div key={index} className={`rounded-lg border p-4 ${getAlertSeverityColor(alert.severity)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">{alert.message}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {alert.severity} priority
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage meters */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* AI Credits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium">AI Credits</span>
            </div>
            <span className={`text-sm font-bold ${getUsageColor(usageStats.percentUsed.tokens)}`}>
              {usageStats.percentUsed.tokens}%
            </span>
          </div>
          <div className="space-y-2">
            <Progress value={usageStats.percentUsed.tokens} className="h-2" />
            <div className="text-xs text-slate-600">
              {usageStats.currentPeriod.tokensUsed.toLocaleString()} / {usageStats.limits.aiCredits.toLocaleString()} tokens
            </div>
          </div>
        </div>

        {/* Projects */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium">Projects</span>
            </div>
            <span className={`text-sm font-bold ${getUsageColor(usageStats.percentUsed.projects)}`}>
              {usageStats.percentUsed.projects}%
            </span>
          </div>
          <div className="space-y-2">
            <Progress value={usageStats.percentUsed.projects} className="h-2" />
            <div className="text-xs text-slate-600">
              {usageStats.currentPeriod.projectsCreated} / {usageStats.limits.projects} projects
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium">Documents</span>
            </div>
            <span className={`text-sm font-bold ${getUsageColor(usageStats.percentUsed.documents)}`}>
              {usageStats.percentUsed.documents}%
            </span>
          </div>
          <div className="space-y-2">
            <Progress value={usageStats.percentUsed.documents} className="h-2" />
            <div className="text-xs text-slate-600">
              {usageStats.currentPeriod.documentsUploaded} / {usageStats.limits.documents} documents
            </div>
          </div>
        </div>

        {/* Cost */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium">Monthly Cost</span>
            </div>
            <span className="text-sm font-bold text-emerald-600">
              ${usageStats.currentPeriod.costUsd.toFixed(2)}
            </span>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-600">
              {usageStats.currentPeriod.eventsCount} API calls this month
            </div>
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-3 w-3 text-green-600" />
              <span className="text-xs text-green-600">Tracking enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsageDashboard;
