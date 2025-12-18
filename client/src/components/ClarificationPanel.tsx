import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  ArrowRight,
  Lightbulb,
  FileQuestion
} from "lucide-react";

export interface ClarificationQuestion {
  id: string;
  category: 'budget' | 'timeline' | 'outcomes' | 'methodology' | 'team' | 'sustainability' | 'evidence' | 'specificity';
  priority: 'critical' | 'high' | 'medium' | 'low';
  questionText: string;
  contextExplanation: string;
  exampleAnswer?: string;
  isAnswered: boolean;
  answer?: string;
  followUpNeeded: boolean;
}

interface ClarificationPanelProps {
  questions: ClarificationQuestion[];
  onAnswerSubmit: (questionId: string, answer: string) => void;
  onSkipQuestion: (questionId: string) => void;
  onRequestFollowUp: (questionId: string) => void;
  isGenerating?: boolean;
  className?: string;
}

export function ClarificationPanel({
  questions,
  onAnswerSubmit,
  onSkipQuestion,
  onRequestFollowUp,
  isGenerating = false,
  className = ""
}: ClarificationPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const answeredCount = questions.filter(q => q.isAnswered).length;
  const completionRate = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  const getCategoryColor = (category: string) => {
    const colors = {
      budget: 'bg-green-100 text-green-800',
      timeline: 'bg-blue-100 text-blue-800',
      outcomes: 'bg-purple-100 text-purple-800',
      methodology: 'bg-yellow-100 text-yellow-800',
      team: 'bg-pink-100 text-pink-800',
      sustainability: 'bg-indigo-100 text-indigo-800',
      evidence: 'bg-orange-100 text-orange-800',
      specificity: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.specificity;
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <HelpCircle className="h-4 w-4 text-yellow-600" />;
      default: return <HelpCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitAnswer = (questionId: string) => {
    const answer = answers[questionId]?.trim();
    if (answer) {
      onAnswerSubmit(questionId, answer);
      setAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        return newAnswers;
      });
    }
  };

  if (questions.length === 0) {
    return (
      <Card className={`${className} border-green-200 bg-green-50`}>
        <CardContent className="p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            No Clarifications Needed
          </h3>
          <p className="text-green-700">
            Your grant application has sufficient information for high-quality generation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} border-amber-200 bg-amber-50`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileQuestion className="h-5 w-5 text-amber-600" />
            <span className="text-amber-900">Clarification Questions</span>
            <Badge className="bg-amber-200 text-amber-800">
              {questions.length} questions
            </Badge>
          </div>
          <div className="text-sm text-amber-700">
            {answeredCount}/{questions.length} completed
          </div>
        </CardTitle>
        <div className="space-y-2">
          <Progress value={completionRate} className="h-2" />
          <p className="text-sm text-amber-700">
            Answering these questions will significantly improve your grant application quality.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {questions.map((question) => {
            const isExpanded = expandedQuestion === question.id;
            const currentAnswer = answers[question.id] || '';
            
            return (
              <Card 
                key={question.id} 
                className={`border transition-all ${
                  question.isAnswered 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <CardHeader 
                  className="pb-3 cursor-pointer"
                  onClick={() => setExpandedQuestion(isExpanded ? null : question.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {getPriorityIcon(question.priority)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getCategoryColor(question.category)}>
                            {question.category}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {question.priority} priority
                          </Badge>
                        </div>
                        <h4 className="font-medium text-slate-900 leading-snug">
                          {question.questionText}
                        </h4>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {question.isAnswered ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <ArrowRight className={`h-4 w-4 transform transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`} />
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && !question.isAnswered && (
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Context Explanation */}
                      <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <div className="flex items-start space-x-2">
                          <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-blue-900 mb-1">Why this matters:</p>
                            <p className="text-sm text-blue-800">{question.contextExplanation}</p>
                          </div>
                        </div>
                      </div>

                      {/* Example Answer */}
                      {question.exampleAnswer && (
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <p className="text-sm font-medium text-slate-700 mb-1">Example response:</p>
                          <p className="text-sm text-slate-600 italic">{question.exampleAnswer}</p>
                        </div>
                      )}

                      {/* Answer Input */}
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Provide your answer here..."
                          value={currentAnswer}
                          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                          className="min-h-[100px]"
                          disabled={isGenerating}
                        />
                        
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => onSkipQuestion(question.id)}
                            className="text-sm text-slate-500 hover:text-slate-700"
                            disabled={isGenerating}
                          >
                            Skip this question
                          </button>
                          
                          <div className="space-x-2">
                            {question.followUpNeeded && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onRequestFollowUp(question.id)}
                                disabled={isGenerating}
                              >
                                Need help?
                              </Button>
                            )}
                            <Button
                              onClick={() => handleSubmitAnswer(question.id)}
                              disabled={!currentAnswer.trim() || isGenerating}
                              size="sm"
                            >
                              Submit Answer
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}

                {/* Show answered content */}
                {question.isAnswered && question.answer && isExpanded && (
                  <CardContent className="pt-0">
                    <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
                      <p className="text-sm font-medium text-green-900 mb-1">Your answer:</p>
                      <p className="text-sm text-green-800">{question.answer}</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Action Footer */}
        {questions.some(q => !q.isAnswered) && (
          <div className="mt-6 p-4 bg-amber-100 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-800">
                  {questions.filter(q => !q.isAnswered).length} questions remaining
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  // Skip all remaining questions
                  questions.filter(q => !q.isAnswered).forEach(q => onSkipQuestion(q.id));
                }}
                disabled={isGenerating}
              >
                Continue without answers
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ClarificationPanel;