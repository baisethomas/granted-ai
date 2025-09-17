"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import type { ClarificationQuestion, ClarificationAnswer } from "@/lib/clarifications/types";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

interface ClarificationQuestionProps {
  question: ClarificationQuestion;
  answer?: ClarificationAnswer;
  onAnswer: (questionId: string, answer: ClarificationAnswer) => void;
  isReadOnly?: boolean;
}

const priorityColors = {
  critical: "bg-red-100 text-red-800 border-red-200",
  high: "bg-orange-100 text-orange-800 border-orange-200", 
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-blue-100 text-blue-800 border-blue-200"
};

const priorityIcons = {
  critical: AlertCircle,
  high: AlertCircle,
  medium: Info,
  low: Info
};

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

export function ClarificationQuestion({ 
  question, 
  answer, 
  onAnswer, 
  isReadOnly = false 
}: ClarificationQuestionProps) {
  const [currentAnswer, setCurrentAnswer] = useState(answer?.answer || "");
  const [isAnswering, setIsAnswering] = useState(false);
  
  const PriorityIcon = priorityIcons[question.priority];
  const isAnswered = !!answer;

  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim()) return;

    const answerData: ClarificationAnswer = {
      questionId: question.id,
      answer: currentAnswer.trim(),
      confidence: currentAnswer.trim().length > 20 ? 0.8 : 0.5, // Simple confidence scoring
      followUpNeeded: false,
      metadata: {
        answeredAt: new Date().toISOString(),
        wordCount: currentAnswer.trim().split(' ').length
      }
    };

    onAnswer(question.id, answerData);
    setIsAnswering(false);
  };

  const handleStartAnswering = () => {
    setIsAnswering(true);
    if (answer) {
      setCurrentAnswer(answer.answer);
    }
  };

  return (
    <Card className={`transition-all duration-200 ${isAnswered ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <PriorityIcon className="h-4 w-4 text-gray-600" />
              <Badge 
                variant="outline" 
                className={priorityColors[question.priority]}
              >
                {question.priority.charAt(0).toUpperCase() + question.priority.slice(1)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {categoryLabels[question.category]}
              </Badge>
            </div>
            <CardTitle className="text-lg font-medium text-gray-900">
              {question.question}
            </CardTitle>
          </div>
          {isAnswered && (
            <div className="flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {/* Context and importance */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Why this matters:</strong> {question.context}
          </p>
        </div>

        {/* Examples if provided */}
        {question.examples && question.examples.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Examples:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {question.examples.map((example, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-gray-400">•</span>
                  <span className="italic">{example}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Related grant questions */}
        {question.relatedQuestions && question.relatedQuestions.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              This helps answer:
            </p>
            <div className="text-sm text-gray-600">
              {question.relatedQuestions.join(', ')}
            </div>
          </div>
        )}

        {/* Answer section */}
        <div className="border-t pt-4">
          {isAnswered && !isAnswering ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Your Answer</h4>
                {!isReadOnly && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleStartAnswering}
                  >
                    Edit Answer
                  </Button>
                )}
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-800 whitespace-pre-wrap">{answer.answer}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>Confidence: {Math.round((answer.confidence || 0) * 100)}%</span>
                {answer.metadata?.wordCount && (
                  <span>{answer.metadata.wordCount} words</span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">
                {isAnswered ? 'Edit Your Answer' : 'Your Answer'}
              </h4>
              <Textarea
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                placeholder={`Please provide specific details for this ${question.category} question...`}
                className="min-h-[120px] resize-vertical"
                disabled={isReadOnly}
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {currentAnswer.trim().split(' ').filter(Boolean).length} words
                </div>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    {isAnswering && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setIsAnswering(false);
                          setCurrentAnswer(answer?.answer || "");
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleSubmitAnswer}
                      disabled={!currentAnswer.trim()}
                    >
                      {isAnswered ? 'Update Answer' : 'Submit Answer'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}