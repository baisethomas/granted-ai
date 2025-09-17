/**
 * Evidence Map Component - Visual representation of source grounding
 * 
 * Shows how well each section of generated content is supported by sources,
 * highlighting areas that need strengthening and providing actionable insights.
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  EvidenceMap as EvidenceMapType, 
  CitationStats, 
  SourceDistribution,
  UnsupportedClaim 
} from '@/lib/citations/types';
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  FileText, 
  BarChart3,
  Eye,
  TrendingUp,
  Shield
} from 'lucide-react';

interface EvidenceMapProps {
  draftId: string;
  evidenceMap: EvidenceMapType;
  citationStats: CitationStats;
  onViewParagraph?: (paragraphId: string) => void;
  onStrengthening?: (claimId: string) => void;
}

export function EvidenceMap({ 
  draftId, 
  evidenceMap, 
  citationStats, 
  onViewParagraph, 
  onStrengthening 
}: EvidenceMapProps) {
  const [activeView, setActiveView] = useState<'overview' | 'sources' | 'issues'>('overview');

  const getStrengthColor = (strength: number): string => {
    if (strength >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (strength >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getStrengthIcon = (strength: number) => {
    if (strength >= 0.8) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (strength >= 0.6) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <AlertCircle className="w-5 h-5 text-red-600" />;
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high'): string => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'high': return 'text-red-600 bg-red-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Overall Score */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            Evidence Map
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Overall Grounding Quality</span>
            <div className={`px-3 py-1 rounded-full border ${getStrengthColor(evidenceMap.evidenceStrength)}`}>
              {Math.round(evidenceMap.evidenceStrength * 100)}%
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(evidenceMap.sourceCoverage)}%
            </div>
            <div className="text-sm text-gray-600">Citation Coverage</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {citationStats.uniqueDocuments}
            </div>
            <div className="text-sm text-gray-600">Unique Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {evidenceMap.unsupportedClaims.length}
            </div>
            <div className="text-sm text-gray-600">Issues Found</div>
          </div>
          <div className="text-center">
            <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${getRiskColor(evidenceMap.hallucinationRisk)}`}>
              {evidenceMap.hallucinationRisk.toUpperCase()}
            </div>
            <div className="text-sm text-gray-600 mt-1">Hallucination Risk</div>
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'sources', label: 'Source Analysis', icon: FileText },
          { key: 'issues', label: 'Issues & Suggestions', icon: AlertTriangle }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content based on active view */}
      {activeView === 'overview' && (
        <OverviewView 
          evidenceMap={evidenceMap} 
          citationStats={citationStats}
          onViewParagraph={onViewParagraph}
        />
      )}

      {activeView === 'sources' && (
        <SourceAnalysisView 
          sourceDistribution={evidenceMap.sourceDistribution}
          citationStats={citationStats}
        />
      )}

      {activeView === 'issues' && (
        <IssuesView 
          unsupportedClaims={evidenceMap.unsupportedClaims}
          hallucinationRisk={evidenceMap.hallucinationRisk}
          onStrengthening={onStrengthening}
        />
      )}
    </div>
  );
}

// Overview View Component
function OverviewView({ 
  evidenceMap, 
  citationStats, 
  onViewParagraph 
}: { 
  evidenceMap: EvidenceMapType; 
  citationStats: CitationStats;
  onViewParagraph?: (paragraphId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Grounding Quality Visualization */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Grounding Quality Analysis</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Evidence Strength</span>
            <span className="text-sm text-gray-600">
              {Math.round(evidenceMap.evidenceStrength * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                evidenceMap.evidenceStrength >= 0.8 ? 'bg-green-500' :
                evidenceMap.evidenceStrength >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${evidenceMap.evidenceStrength * 100}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm font-medium">Citation Coverage</span>
            <span className="text-sm text-gray-600">
              {Math.round(evidenceMap.sourceCoverage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                evidenceMap.sourceCoverage >= 80 ? 'bg-green-500' :
                evidenceMap.sourceCoverage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${evidenceMap.sourceCoverage}%` }}
            />
          </div>
        </div>

        {/* Quality Recommendations */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Quality Assessment</h4>
          <p className="text-sm text-blue-800">
            {evidenceMap.evidenceStrength >= 0.85 
              ? "Excellent grounding quality. Your content is well-supported by evidence."
              : evidenceMap.evidenceStrength >= 0.7
              ? "Good grounding quality with room for improvement. Consider strengthening some claims."
              : "Grounding quality needs improvement. Several claims lack sufficient evidence support."
            }
          </p>
        </div>
      </Card>

      {/* Citation Statistics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Citation Statistics</h3>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Paragraphs</span>
              <span className="text-sm font-medium">{citationStats.totalParagraphs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Cited Paragraphs</span>
              <span className="text-sm font-medium">{citationStats.citedParagraphs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Sources</span>
              <span className="text-sm font-medium">{citationStats.totalSources}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Unique Documents</span>
              <span className="text-sm font-medium">{citationStats.uniqueDocuments}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Avg. Grounding Quality</span>
              <span className="text-sm font-medium">
                {Math.round(citationStats.averageGroundingQuality * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Citation Coverage</span>
              <span className="text-sm font-medium">
                {Math.round(citationStats.citationCoverage)}%
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Source Analysis View Component
function SourceAnalysisView({ 
  sourceDistribution, 
  citationStats 
}: { 
  sourceDistribution: SourceDistribution[];
  citationStats: CitationStats;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Source Distribution Analysis</h3>
      <div className="space-y-4">
        {sourceDistribution.map((source, index) => (
          <div key={source.documentId} className="border rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{source.documentName}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {source.citationCount} citations ({Math.round(source.coveragePercentage)}% of total)
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {Math.round(source.averageSimilarity * 100)}%
                </div>
                <div className="text-xs text-gray-500">Avg. Similarity</div>
              </div>
            </div>
            
            {/* Usage bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${source.coveragePercentage}%` }}
              />
            </div>
            
            {/* Quality indicator */}
            <div className="mt-2 flex items-center gap-2">
              {source.averageSimilarity >= 0.8 ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : source.averageSimilarity >= 0.6 ? (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-600">
                {source.averageSimilarity >= 0.8 ? 'High quality citations' :
                 source.averageSimilarity >= 0.6 ? 'Moderate quality citations' :
                 'Low quality citations - needs strengthening'}
              </span>
            </div>
          </div>
        ))}
        
        {sourceDistribution.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No source citations found</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// Issues View Component  
function IssuesView({ 
  unsupportedClaims, 
  hallucinationRisk,
  onStrengthening 
}: { 
  unsupportedClaims: UnsupportedClaim[];
  hallucinationRisk: 'low' | 'medium' | 'high';
  onStrengthening?: (claimId: string) => void;
}) {
  const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'low': return 'border-yellow-200 bg-yellow-50';
      case 'medium': return 'border-orange-200 bg-orange-50';
      case 'high': return 'border-red-200 bg-red-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Risk Assessment */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Hallucination Risk Assessment</h3>
        <div className={`p-4 rounded-lg border-2 ${getRiskColor(hallucinationRisk)}`}>
          <div className="flex items-center gap-3">
            {hallucinationRisk === 'high' ? (
              <AlertCircle className="w-6 h-6 text-red-600" />
            ) : hallucinationRisk === 'medium' ? (
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-600" />
            )}
            <div>
              <div className="font-semibold">
                {hallucinationRisk === 'high' ? 'High Risk' :
                 hallucinationRisk === 'medium' ? 'Medium Risk' : 'Low Risk'}
              </div>
              <div className="text-sm opacity-80">
                {hallucinationRisk === 'high' 
                  ? 'Multiple claims lack supporting evidence. Review carefully before submission.'
                  : hallucinationRisk === 'medium'
                  ? 'Some claims need stronger evidence. Consider adding more citations.'
                  : 'Content is well-grounded with good evidence support.'
                }
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Unsupported Claims */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          Issues Requiring Attention ({unsupportedClaims.length})
        </h3>
        <div className="space-y-4">
          {unsupportedClaims.map((claim, index) => (
            <div 
              key={index} 
              className={`border rounded-lg p-4 ${getSeverityColor(claim.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {claim.severity === 'high' ? (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    ) : claim.severity === 'medium' ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="font-medium text-sm capitalize">
                      {claim.severity} Priority
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mb-2">"{claim.text}"</p>
                  <p className="text-xs text-gray-600">{claim.reason}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStrengthening?.(index.toString())}
                  className="ml-4"
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Strengthen
                </Button>
              </div>
            </div>
          ))}
          
          {unsupportedClaims.length === 0 && (
            <div className="text-center py-8 text-green-600">
              <CheckCircle className="w-12 h-12 mx-auto mb-2" />
              <p className="font-medium">No issues found!</p>
              <p className="text-sm text-gray-600">All claims appear to be well-supported.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}