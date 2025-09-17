"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { AssumptionLabel } from "@/lib/clarifications/types";
import { 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  HelpCircle,
  RefreshCw
} from "lucide-react";

interface AssumptionHighlighterProps {
  generatedText: string;
  grantQuestions: string[];
  organizationId?: string;
  existingContext?: string;
  onAssumptionsDetected?: (assumptions: AssumptionLabel[], labeledText: string) => void;
}

const categoryColors = {
  budget: "bg-red-100 border-red-300 text-red-800",
  timeline: "bg-orange-100 border-orange-300 text-orange-800", 
  outcomes: "bg-yellow-100 border-yellow-300 text-yellow-800",
  methodology: "bg-green-100 border-green-300 text-green-800",
  team: "bg-blue-100 border-blue-300 text-blue-800",
  sustainability: "bg-indigo-100 border-indigo-300 text-indigo-800",
  evidence: "bg-purple-100 border-purple-300 text-purple-800",
  specificity: "bg-gray-100 border-gray-300 text-gray-800"
};

const categoryLabels = {
  budget: "Budget",
  timeline: "Timeline", 
  outcomes: "Outcomes",
  methodology: "Methods",
  team: "Team",
  sustainability: "Sustainability",
  evidence: "Evidence",
  specificity: "Specifics"
};

export function AssumptionHighlighter({
  generatedText,
  grantQuestions,
  organizationId,
  existingContext = "",
  onAssumptionsDetected
}: AssumptionHighlighterProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [assumptions, setAssumptions] = useState<AssumptionLabel[]>([]);
  const [labeledText, setLabeledText] = useState(generatedText);
  const [showAssumptions, setShowAssumptions] = useState(true);
  const [selectedAssumption, setSelectedAssumption] = useState<AssumptionLabel | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  useEffect(() => {
    if (generatedText && grantQuestions.length > 0 && !hasAnalyzed) {
      analyzeAssumptions();
    }
  }, [generatedText, grantQuestions, hasAnalyzed]);

  const analyzeAssumptions = async () => {
    if (!generatedText.trim()) return;

    setIsAnalyzing(true);
    
    try {
      const response = await fetch('/api/clarifications/assumptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedText,
          grantQuestions,
          organizationId,
          existingContext
        })
      });

      if (!response.ok) {
        throw new Error('Failed to analyze assumptions');
      }

      const data = await response.json();
      setAssumptions(data.assumptions || []);
      setLabeledText(data.labeledText || generatedText);
      setHasAnalyzed(true);

      if (onAssumptionsDetected) {
        onAssumptionsDetected(data.assumptions || [], data.labeledText || generatedText);
      }
    } catch (error) {
      console.error('Error analyzing assumptions:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleAssumptionVisibility = () => {
    setShowAssumptions(!showAssumptions);
  };

  const getDisplayText = () => {
    if (!showAssumptions || assumptions.length === 0) {
      return generatedText;
    }
    return labeledText;
  };

  if (isAnalyzing) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center space-y-3">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
            <p className="text-sm text-gray-600">Analyzing content for assumptions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      {assumptions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <div>
                  <CardTitle className="text-lg">
                    {assumptions.length} Assumption{assumptions.length !== 1 ? 's' : ''} Detected
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Areas where additional information could strengthen your application
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAssumptionVisibility}
                className="flex items-center gap-2"
              >
                {showAssumptions ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide Highlights
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Show Highlights
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Category breakdown */}
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(
                assumptions.reduce((acc, assumption) => {
                  acc[assumption.category] = (acc[assumption.category] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([category, count]) => (
                <Badge 
                  key={category}
                  variant="outline"
                  className={categoryColors[category as keyof typeof categoryColors]}
                >
                  {categoryLabels[category as keyof typeof categoryLabels]}: {count}
                </Badge>
              ))}
            </div>

            {/* Assumption list */}
            {showAssumptions && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900">Detected Assumptions:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {assumptions.map((assumption, index) => (
                    <div
                      key={assumption.id}
                      className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm cursor-pointer hover:bg-gray-100"
                      onClick={() => setSelectedAssumption(
                        selectedAssumption?.id === assumption.id ? null : assumption
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${categoryColors[assumption.category]}`}
                            >
                              {categoryLabels[assumption.category]}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {Math.round(assumption.confidence * 100)}% confident
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mb-1">
                            "{assumption.text}"
                          </p>
                          {selectedAssumption?.id === assumption.id && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-gray-700 mb-2">
                                <strong>Suggested question:</strong>
                              </p>
                              <p className="text-gray-600 italic">
                                {assumption.suggestedQuestion}
                              </p>
                            </div>
                          )}
                        </div>
                        <HelpCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated text with highlighting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Generated Content
            {assumptions.length > 0 && showAssumptions && (
              <Badge variant="outline" className="text-xs">
                {assumptions.length} assumptions highlighted
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <div 
              className="whitespace-pre-wrap text-gray-800 leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: getDisplayText().replace(/\n/g, '<br/>') 
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legend for assumption highlights */}
      {assumptions.length > 0 && showAssumptions && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-orange-800">
                <strong>Highlighted text</strong> represents assumptions that could be strengthened with additional information.
                Click on assumption items above to see suggested clarifying questions.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// CSS for assumption highlighting (add to global styles)
const assumptionHighlightStyles = `
.assumption-highlight {
  background-color: #fef3c7;
  border-bottom: 2px solid #f59e0b;
  padding: 1px 2px;
  border-radius: 2px;
  cursor: help;
  position: relative;
}

.assumption-highlight:hover {
  background-color: #fde68a;
}
`;

// Export styles for integration
export { assumptionHighlightStyles };