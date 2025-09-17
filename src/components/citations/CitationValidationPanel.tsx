/**
 * Citation Validation Panel - Real-time validation and quality assessment
 * 
 * Provides continuous validation of citations with actionable feedback
 * and suggestions for improvement.
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  RealTimeValidation,
  ValidationIssue,
  CitationSuggestion,
  GroundingAnalysis 
} from '@/lib/citations/types';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  TrendingUp,
  Lightbulb,
  FileSearch,
  Target
} from 'lucide-react';

interface CitationValidationPanelProps {
  draftId: string;
  validations: RealTimeValidation[];
  groundingAnalyses: GroundingAnalysis[];
  onRevalidate: (paragraphId: string) => void;
  onApplySuggestion: (suggestion: CitationSuggestion) => void;
  onViewParagraph: (paragraphId: string) => void;
  isValidating?: boolean;
}

export function CitationValidationPanel({
  draftId,
  validations,
  groundingAnalyses,
  onRevalidate,
  onApplySuggestion,
  onViewParagraph,
  isValidating = false
}: CitationValidationPanelProps) {
  const [activeTab, setActiveTab] = useState<'validation' | 'grounding' | 'suggestions'>('validation');
  const [autoValidate, setAutoValidate] = useState(true);

  // Auto-validation every 30 seconds if enabled
  useEffect(() => {
    if (!autoValidate) return;
    
    const interval = setInterval(() => {
      validations
        .filter(v => v.needsRevalidation)
        .forEach(v => onRevalidate(v.paragraphId));
    }, 30000);

    return () => clearInterval(interval);
  }, [autoValidate, validations, onRevalidate]);

  const getValidationSummary = () => {
    const total = validations.length;
    const passing = validations.filter(v => v.validationResults.length === 0).length;
    const warnings = validations.filter(v => 
      v.validationResults.some(r => r.severity === 'medium')
    ).length;
    const errors = validations.filter(v => 
      v.validationResults.some(r => r.severity === 'high')
    ).length;

    return { total, passing, warnings, errors };
  };

  const summary = getValidationSummary();

  return (
    <div className="space-y-4">
      {/* Header with Summary */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Citation Validation
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoValidate}
                onChange={(e) => setAutoValidate(e.target.checked)}
                className="rounded"
              />
              Auto-validate
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => validations.forEach(v => onRevalidate(v.paragraphId))}
              disabled={isValidating}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isValidating ? 'animate-spin' : ''}`} />
              Refresh All
            </Button>
          </div>
        </div>

        {/* Validation Summary */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{summary.passing}</div>
            <div className="text-sm text-gray-600">Validated</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
            <div className="text-sm text-gray-600">Warnings</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
            <div className="text-sm text-gray-600">Errors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'validation', label: 'Real-time Validation', icon: CheckCircle2 },
          { key: 'grounding', label: 'Grounding Analysis', icon: FileSearch },
          { key: 'suggestions', label: 'Improvement Suggestions', icon: Lightbulb }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'validation' && (
        <ValidationTab
          validations={validations}
          onRevalidate={onRevalidate}
          onViewParagraph={onViewParagraph}
          isValidating={isValidating}
        />
      )}

      {activeTab === 'grounding' && (
        <GroundingTab
          analyses={groundingAnalyses}
          onViewParagraph={onViewParagraph}
        />
      )}

      {activeTab === 'suggestions' && (
        <SuggestionsTab
          validations={validations}
          analyses={groundingAnalyses}
          onApplySuggestion={onApplySuggestion}
          onViewParagraph={onViewParagraph}
        />
      )}
    </div>
  );
}

// Validation Tab Component
function ValidationTab({
  validations,
  onRevalidate,
  onViewParagraph,
  isValidating
}: {
  validations: RealTimeValidation[];
  onRevalidate: (paragraphId: string) => void;
  onViewParagraph: (paragraphId: string) => void;
  isValidating: boolean;
}) {
  const sortedValidations = [...validations].sort((a, b) => {
    // Sort by: errors first, then warnings, then passing
    const aHasErrors = a.validationResults.some(r => r.severity === 'high');
    const bHasErrors = b.validationResults.some(r => r.severity === 'high');
    const aHasWarnings = a.validationResults.some(r => r.severity === 'medium');
    const bHasWarnings = b.validationResults.some(r => r.severity === 'medium');

    if (aHasErrors && !bHasErrors) return -1;
    if (!aHasErrors && bHasErrors) return 1;
    if (aHasWarnings && !bHasWarnings) return -1;
    if (!aHasWarnings && bHasWarnings) return 1;

    return b.groundingScore - a.groundingScore;
  });

  return (
    <div className="space-y-3">
      {sortedValidations.map((validation) => (
        <ValidationCard
          key={validation.paragraphId}
          validation={validation}
          onRevalidate={onRevalidate}
          onViewParagraph={onViewParagraph}
          isValidating={isValidating}
        />
      ))}

      {validations.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No validation data available</p>
          <p className="text-sm mt-2">Generate content to see validation results</p>
        </Card>
      )}
    </div>
  );
}

// Individual Validation Card
function ValidationCard({
  validation,
  onRevalidate,
  onViewParagraph,
  isValidating
}: {
  validation: RealTimeValidation;
  onRevalidate: (paragraphId: string) => void;
  onViewParagraph: (paragraphId: string) => void;
  isValidating: boolean;
}) {
  const hasErrors = validation.validationResults.some(r => r.severity === 'high');
  const hasWarnings = validation.validationResults.some(r => r.severity === 'medium');
  const isPassing = validation.validationResults.length === 0;

  const getStatusColor = (): string => {
    if (hasErrors) return 'border-red-200 bg-red-50';
    if (hasWarnings) return 'border-yellow-200 bg-yellow-50';
    return 'border-green-200 bg-green-50';
  };

  const getStatusIcon = () => {
    if (hasErrors) return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (hasWarnings) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  };

  return (
    <Card className={`p-4 border-2 ${getStatusColor()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <div className="font-medium text-sm">
              Paragraph {validation.paragraphId.split('-')[1] || validation.paragraphId}
            </div>
            <div className="text-xs text-gray-600">
              Grounding: {Math.round(validation.groundingScore * 100)}% • 
              Last validated: {validation.lastValidated.toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewParagraph(validation.paragraphId)}
          >
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRevalidate(validation.paragraphId)}
            disabled={isValidating}
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Validation Issues */}
      {validation.validationResults.map((issue, index) => (
        <div key={index} className="mb-2 last:mb-0">
          <div className="flex items-start gap-2">
            <div className={`w-1 h-1 rounded-full mt-2 ${
              issue.severity === 'high' ? 'bg-red-500' :
              issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
            }`} />
            <div className="flex-1">
              <div className="text-sm text-gray-800">{issue.description}</div>
              {issue.suggestion && (
                <div className="text-xs text-gray-600 mt-1 italic">
                  Suggestion: {issue.suggestion}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {isPassing && (
        <div className="text-sm text-green-700">
          ✓ All validations passed
        </div>
      )}
    </Card>
  );
}

// Grounding Analysis Tab
function GroundingTab({
  analyses,
  onViewParagraph
}: {
  analyses: GroundingAnalysis[];
  onViewParagraph: (paragraphId: string) => void;
}) {
  const sortedAnalyses = [...analyses].sort((a, b) => a.groundingQuality - b.groundingQuality);

  return (
    <div className="space-y-3">
      {sortedAnalyses.map((analysis) => (
        <Card 
          key={analysis.paragraphId} 
          className={`p-4 border-2 ${
            analysis.issueSeverity === 'high' ? 'border-red-200 bg-red-50' :
            analysis.issueSeverity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
            'border-green-200 bg-green-50'
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="font-medium text-sm mb-1">
                Paragraph {analysis.paragraphId.split('-')[1] || analysis.paragraphId}
              </div>
              <div className="text-sm text-gray-600 mb-2 line-clamp-2">
                {analysis.paragraphText.slice(0, 120)}...
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span>Quality: {Math.round(analysis.groundingQuality * 100)}%</span>
                <span className={`px-2 py-1 rounded capitalize ${
                  analysis.issueSeverity === 'high' ? 'bg-red-100 text-red-800' :
                  analysis.issueSeverity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {analysis.issueSeverity} Priority
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewParagraph(analysis.paragraphId)}
            >
              View
            </Button>
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-700">Recommendations:</div>
              {analysis.recommendations.map((rec, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-start gap-2">
                  <TrendingUp className="w-3 h-3 mt-0.5 text-blue-500" />
                  {rec}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {analyses.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          <FileSearch className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No grounding analysis available</p>
          <p className="text-sm mt-2">Analysis will appear after content generation</p>
        </Card>
      )}
    </div>
  );
}

// Suggestions Tab
function SuggestionsTab({
  validations,
  analyses,
  onApplySuggestion,
  onViewParagraph
}: {
  validations: RealTimeValidation[];
  analyses: GroundingAnalysis[];
  onApplySuggestion: (suggestion: CitationSuggestion) => void;
  onViewParagraph: (paragraphId: string) => void;
}) {
  // Generate suggestions from validation issues and analyses
  const suggestions: Array<{
    type: 'citation' | 'strengthening' | 'revision';
    priority: 'high' | 'medium' | 'low';
    description: string;
    paragraphId: string;
    action: () => void;
  }> = [];

  // Add suggestions from validation issues
  validations.forEach(validation => {
    validation.validationResults.forEach(issue => {
      if (issue.suggestion) {
        suggestions.push({
          type: 'citation',
          priority: issue.severity,
          description: issue.suggestion,
          paragraphId: validation.paragraphId,
          action: () => onApplySuggestion({
            type: 'add_citation',
            description: issue.suggestion,
            position: { start: 0, end: 100 }
          })
        });
      }
    });
  });

  // Add suggestions from grounding analysis
  analyses.forEach(analysis => {
    if (analysis.groundingQuality < 0.6) {
      suggestions.push({
        type: 'strengthening',
        priority: analysis.issueSeverity,
        description: `Strengthen evidence support (currently ${Math.round(analysis.groundingQuality * 100)}%)`,
        paragraphId: analysis.paragraphId,
        action: () => onViewParagraph(analysis.paragraphId)
      });
    }
  });

  const sortedSuggestions = suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className="space-y-3">
      {sortedSuggestions.map((suggestion, index) => (
        <Card key={index} className="p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className={`px-2 py-1 text-xs rounded capitalize font-medium ${
                  suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                  suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {suggestion.priority} Priority
                </span>
                <span className="text-xs text-gray-500 capitalize">
                  {suggestion.type}
                </span>
              </div>
              <p className="text-sm text-gray-800 mb-2">{suggestion.description}</p>
              <div className="text-xs text-gray-600">
                Paragraph {suggestion.paragraphId.split('-')[1] || suggestion.paragraphId}
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewParagraph(suggestion.paragraphId)}
              >
                View
              </Button>
              <Button
                size="sm"
                onClick={suggestion.action}
              >
                Apply
              </Button>
            </div>
          </div>
        </Card>
      ))}

      {sortedSuggestions.length === 0 && (
        <Card className="p-8 text-center text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
          <p className="font-medium text-green-600">No suggestions needed!</p>
          <p className="text-sm mt-2">Your content appears to be well-supported with good citation quality.</p>
        </Card>
      )}
    </div>
  );
}