"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { 
  BarChart, 
  TrendingUp, 
  TrendingDown,
  Users, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Target,
  Award,
  RefreshCw
} from "lucide-react";

interface ClarificationDashboardProps {
  organizationId: string;
}

interface DashboardData {
  analytics: {
    totalSessions: number;
    completionRate: number;
    avgQuestionsPerSession: number;
    topCategories: Array<{ category: string; count: number }>;
    qualityImpact: number;
  };
  recentSessions: Array<{
    projectId: string;
    status: string;
    completionRate: number;
    questionCount: number;
    answerCount: number;
    qualityScore?: number;
  }>;
  recommendations: string[];
}

const categoryLabels = {
  budget: "Budget & Costs",
  timeline: "Timeline & Milestones",
  outcomes: "Outcomes & Impact",
  methodology: "Methods & Approach",
  team: "Team & Capacity",
  sustainability: "Sustainability",
  evidence: "Evidence & Data",
  specificity: "Specifics & Details"
};

const categoryColors = {
  budget: "bg-red-100 text-red-800 border-red-200",
  timeline: "bg-orange-100 text-orange-800 border-orange-200",
  outcomes: "bg-yellow-100 text-yellow-800 border-yellow-200",
  methodology: "bg-green-100 text-green-800 border-green-200",
  team: "bg-blue-100 text-blue-800 border-blue-200",
  sustainability: "bg-indigo-100 text-indigo-800 border-indigo-200",
  evidence: "bg-purple-100 text-purple-800 border-purple-200",
  specificity: "bg-gray-100 text-gray-800 border-gray-200"
};

export function ClarificationDashboard({ organizationId }: ClarificationDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [organizationId]);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const response = await fetch(
        `/api/clarifications/analytics?organizationId=${organizationId}&type=overview`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load analytics data');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 0.8) return "text-green-600";
    if (rate >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Loading Analytics
              </h3>
              <p className="text-gray-600 mt-1">
                Analyzing clarification effectiveness...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Analytics Error
              </h3>
              <p className="text-sm text-red-600 mt-1">
                {error || 'Failed to load analytics data'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Try Again'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { analytics, recentSessions, recommendations } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Clarification Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Track the effectiveness of your clarification questions in improving grant applications
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.totalSessions}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className={`text-2xl font-bold ${getCompletionRateColor(analytics.completionRate)}`}>
                  {Math.round(analytics.completionRate * 100)}%
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Avg Questions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.avgQuestionsPerSession.toFixed(1)}
                </p>
              </div>
              <Target className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Quality Impact</p>
                <p className={`text-2xl font-bold ${getQualityScoreColor(analytics.qualityImpact)}`}>
                  {Math.round(analytics.qualityImpact)}
                </p>
              </div>
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Top Clarification Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topCategories.length > 0 ? (
            <div className="space-y-3">
              {analytics.topCategories.map((category, index) => {
                const maxCount = Math.max(...analytics.topCategories.map(c => c.count));
                const percentage = (category.count / maxCount) * 100;
                
                return (
                  <div key={category.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">#{index + 1}</span>
                        <Badge 
                          variant="outline" 
                          className={categoryColors[category.category as keyof typeof categoryColors]}
                        >
                          {categoryLabels[category.category as keyof typeof categoryLabels] || category.category}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-600">
                        {category.count} question{category.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No clarification sessions found yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentSessions.length > 0 ? (
            <div className="space-y-4">
              {recentSessions.map((session, index) => (
                <div key={`${session.projectId}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        Project {session.projectId.slice(0, 8)}...
                      </span>
                      <Badge 
                        variant="outline"
                        className={
                          session.status === 'completed' 
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : session.status === 'active'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        }
                      >
                        {session.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>{session.answerCount}/{session.questionCount} answered</span>
                      <span className={getCompletionRateColor(session.completionRate)}>
                        {Math.round(session.completionRate * 100)}% complete
                      </span>
                      {session.qualityScore && (
                        <span className={getQualityScoreColor(session.qualityScore)}>
                          Quality: {session.qualityScore}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    {session.completionRate >= 0.8 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : session.completionRate >= 0.5 ? (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No recent sessions found
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-800">
                    {index + 1}
                  </div>
                  <p className="text-sm text-blue-800 flex-1">
                    {recommendation}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No specific recommendations at this time
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}