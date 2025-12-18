import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  DollarSign, 
  FileText, 
  Users,
  AlertTriangle,
  CheckCircle,
  Zap,
  BarChart3
} from "lucide-react";
import { UsageStats, UsageTracker } from "@/lib/usage-tracking";

interface UsageDashboardProps {
  organizationId: number;
  className?: string;
}

export function UsageDashboard({ organizationId, className = "" }: UsageDashboardProps) {
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsageStats = async () => {
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
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-20 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usageStats) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-slate-600">Unable to load usage statistics</p>
        </CardContent>
      </Card>
    );
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
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
            <Card key={index} className={`border ${getAlertSeverityColor(alert.severity)}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {alert.severity} priority
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span>Usage Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* AI Credits */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-purple-600" />
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
                  <FileText className="h-4 w-4 text-blue-600" />
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
                  <FileText className="h-4 w-4 text-green-600" />
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
                  <DollarSign className="h-4 w-4 text-emerald-600" />
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
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              <TrendingUp className="mr-2 h-4 w-4" />
              View Detailed Analytics
            </Button>
            <Button variant="outline" size="sm">
              <DollarSign className="mr-2 h-4 w-4" />
              Billing Settings
            </Button>
            <Button variant="outline" size="sm">
              <Users className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsageDashboard;