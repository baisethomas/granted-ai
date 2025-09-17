"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw,
  TestTube,
  Lightbulb,
  Target,
  TrendingUp,
  Clock
} from "lucide-react";

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  metrics?: any;
}

interface ValidationResults {
  testType: string;
  passed: boolean;
  overallScore?: number;
  summary?: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
  results?: TestResult[];
  recommendations?: string[];
  timestamp: string;
}

export default function ClarificationValidationPage() {
  const [testResults, setTestResults] = useState<ValidationResults | null>(null);
  const [customQuestions, setCustomQuestions] = useState("");
  const [customContext, setCustomContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [testType, setTestType] = useState<'smoke' | 'comprehensive' | 'custom'>('comprehensive');

  const runTests = async (type: 'smoke' | 'comprehensive' | 'custom') => {
    setLoading(true);
    setTestResults(null);

    try {
      let response;
      
      if (type === 'custom') {
        if (!customQuestions.trim() || !customContext.trim()) {
          alert("Please provide both grant questions and organizational context for custom testing");
          return;
        }

        const questions = customQuestions
          .split('\n')
          .map(q => q.trim())
          .filter(Boolean);

        response = await fetch('/api/clarifications/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testType: 'custom',
            grantQuestions: questions,
            organizationContext: customContext.trim()
          })
        });
      } else {
        response = await fetch(`/api/clarifications/test?type=${type}`);
      }

      if (!response.ok) {
        throw new Error(`Test failed with status ${response.status}`);
      }

      const results = await response.json();
      setTestResults(results);
    } catch (error) {
      console.error('Test execution error:', error);
      setTestResults({
        testType: type,
        passed: false,
        timestamp: new Date().toISOString(),
        recommendations: [`❌ Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Clarification Engine Validation
        </h1>
        <p className="text-gray-600 mt-1">
          Test and validate the intelligent question-asking system for grant applications
        </p>
      </div>

      {/* Test Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Smoke Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-600" />
              Smoke Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Quick test to verify basic functionality is working
            </p>
            <Button 
              onClick={() => runTests('smoke')}
              disabled={loading}
              className="w-full"
              variant={testType === 'smoke' ? 'default' : 'outline'}
            >
              {loading && testType === 'smoke' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Smoke Test
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Comprehensive Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5 text-blue-600" />
              Comprehensive Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Full validation suite testing all system components
            </p>
            <Button 
              onClick={() => runTests('comprehensive')}
              disabled={loading}
              className="w-full"
              variant={testType === 'comprehensive' ? 'default' : 'outline'}
            >
              {loading && testType === 'comprehensive' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Run Full Suite
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Custom Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Custom Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Test with your own grant questions and context
            </p>
            <Button 
              onClick={() => runTests('custom')}
              disabled={loading || !customQuestions.trim() || !customContext.trim()}
              className="w-full"
              variant={testType === 'custom' ? 'default' : 'outline'}
            >
              {loading && testType === 'custom' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Test Custom Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Custom Test Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Test Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grant Questions (one per line)
            </label>
            <Textarea
              value={customQuestions}
              onChange={(e) => setCustomQuestions(e.target.value)}
              placeholder={`What is your organization's mission?
Describe your target population and service area.
What is your total project budget?
How will you measure success?`}
              className="min-h-[100px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organizational Context
            </label>
            <Textarea
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Provide your organization's background, programs, and any relevant context..."
              className="min-h-[120px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults && (
        <div className="space-y-6">
          {/* Overall Results */}
          <Card className={testResults.passed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {testResults.passed ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <span className={testResults.passed ? 'text-green-900' : 'text-red-900'}>
                  {testResults.testType.charAt(0).toUpperCase() + testResults.testType.slice(1)} Test Results
                </span>
                {testResults.overallScore !== undefined && (
                  <Badge variant="outline" className={getScoreBadgeColor(testResults.overallScore)}>
                    {testResults.overallScore}% Score
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {testResults.summary && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {testResults.summary.totalTests}
                    </div>
                    <div className="text-sm text-gray-600">Total Tests</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.summary.passedTests}
                    </div>
                    <div className="text-sm text-gray-600">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {testResults.summary.failedTests}
                    </div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className={testResults.passed ? 'text-green-700' : 'text-red-700'}>
                  Status: {testResults.passed ? '✅ All systems operational' : '❌ Issues detected'}
                </span>
                <span className="text-gray-500">
                  <Clock className="h-4 w-4 inline mr-1" />
                  {new Date(testResults.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Individual Test Results */}
          {testResults.results && testResults.results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testResults.results.map((result, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        {result.passed ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <h3 className="font-medium text-gray-900">
                          {result.testName}
                        </h3>
                        <Badge variant={result.passed ? "default" : "destructive"}>
                          {result.passed ? 'PASS' : 'FAIL'}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 pl-8">
                        {result.details.split('\n').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                      {result.metrics && (
                        <div className="mt-2 pl-8">
                          <details className="text-xs text-gray-500">
                            <summary className="cursor-pointer hover:text-gray-700">
                              View metrics
                            </summary>
                            <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                              {JSON.stringify(result.metrics, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {testResults.recommendations && testResults.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-600" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {testResults.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center text-xs font-medium text-yellow-800">
                        {index + 1}
                      </div>
                      <p className="text-sm text-yellow-800 flex-1">
                        {recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-green-600">✓</div>
              <div className="text-xs text-gray-600">Gap Analysis</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">✓</div>
              <div className="text-xs text-gray-600">Question Generation</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">✓</div>
              <div className="text-xs text-gray-600">Assumption Detection</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-green-600">✓</div>
              <div className="text-xs text-gray-600">Quality Metrics</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}