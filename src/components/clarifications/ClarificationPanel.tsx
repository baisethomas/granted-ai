"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ClarificationQuestion } from "./ClarificationQuestion";
import { Badge } from "@/components/ui/Badge";
import type { 
  ClarificationSession, 
  ClarificationQuestion as ClarificationQuestionType,
  ClarificationAnswer 
} from "@/lib/clarifications/types";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  ArrowRight,
  RefreshCw,
  Lightbulb
} from "lucide-react";

interface ClarificationPanelProps {
  grantQuestions: string[];
  organizationId: string;
  existingContext?: string;
  tone?: string;
  onClarificationsComplete: (enhancedContext: string, session: ClarificationSession) => void;
  onSkip?: () => void;
}

export function ClarificationPanel({
  grantQuestions,
  organizationId, 
  existingContext = "",
  tone = "professional",
  onClarificationsComplete,
  onSkip
}: ClarificationPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [questions, setQuestions] = useState<ClarificationQuestionType[]>([]);
  const [answers, setAnswers] = useState<Record<string, ClarificationAnswer>>({});
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = Object.keys(answers).length;
  const completionRate = questions.length > 0 ? answeredCount / questions.length : 0;
  const isComplete = completionRate >= 0.8; // 80% completion threshold

  useEffect(() => {
    if (grantQuestions.length > 0 && organizationId && !hasAnalyzed) {
      analyzeClarifications();
    }
  }, [grantQuestions, organizationId, hasAnalyzed]);

  const analyzeClarifications = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/clarifications/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantQuestions,
          organizationId,
          existingContext,
          tone
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze clarifications');
      }

      const data = await response.json();
      setQuestions(data.questions || []);
      setHasAnalyzed(true);
    } catch (error) {
      console.error('Error analyzing clarifications:', error);
      setError('Unable to analyze information gaps. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnswer = (questionId: string, answer: ClarificationAnswer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleComplete = () => {
    // Build enhanced context with clarification answers
    const clarificationContext = Object.values(answers)
      .map(answer => {
        const question = questions.find(q => q.id === answer.questionId);
        if (!question) return '';
        
        return `**${question.category.toUpperCase()} CLARIFICATION:**
Q: ${question.question}
A: ${answer.answer}
Context: ${question.context}`;
      })
      .filter(Boolean)
      .join('\n\n');

    const enhancedContext = existingContext + 
      (clarificationContext ? `\n\n--- CLARIFYING INFORMATION ---\n\n${clarificationContext}` : '');

    // Create session object
    const session: ClarificationSession = {
      projectId: organizationId, // Using organizationId as projectId for now
      questions,
      answers: Object.values(answers),
      assumptions: [],
      status: isComplete ? 'completed' : 'active',
      completionRate,
      qualityScore: completionRate * 100
    };

    onClarificationsComplete(enhancedContext, session);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      handleComplete(); // Default behavior
    }
  };

  if (isAnalyzing) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Analyzing Your Grant Application
              </h3>
              <p className="text-gray-600 mt-1">
                Identifying missing information and generating clarifying questions...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setHasAnalyzed(false);
              }}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="w-full border-green-200 bg-green-50">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                Great! No Critical Information Gaps Found
              </h3>
              <p className="text-sm text-green-600 mt-1">
                Your application appears to have sufficient detail for strong grant responses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            <div className="flex-1">
              <CardTitle className="text-lg text-blue-900">
                Clarifying Questions
              </CardTitle>
              <p className="text-sm text-blue-700 mt-1">
                We found {questions.length} key areas where additional information would strengthen your grant application.
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {answeredCount}/{questions.length}
              </div>
              <div className="text-xs text-blue-600">answered</div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isComplete ? "default" : "outline"}>
                {Math.round(completionRate * 100)}% Complete
              </Badge>
              {isComplete && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ready to Generate
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkip}
              >
                Skip for Now
              </Button>
              {answeredCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleComplete}
                  className="flex items-center gap-2"
                >
                  Continue with {answeredCount} Answer{answeredCount !== 1 ? 's' : ''}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${completionRate * 100}%` }}
        />
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question) => (
          <ClarificationQuestion
            key={question.id}
            question={question}
            answer={answers[question.id]}
            onAnswer={handleAnswer}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleSkip}
        >
          Skip Clarifications
        </Button>
        <Button
          onClick={handleComplete}
          disabled={answeredCount === 0}
          className="flex items-center gap-2"
        >
          {answeredCount === 0 ? (
            <>
              <Clock className="h-4 w-4" />
              Answer Questions to Continue
            </>
          ) : isComplete ? (
            <>
              <CheckCircle className="h-4 w-4" />
              Generate Enhanced Draft
            </>
          ) : (
            <>
              Continue with {answeredCount} Answer{answeredCount !== 1 ? 's' : ''}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}