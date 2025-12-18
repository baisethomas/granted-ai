import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, XCircle, FileText, Target, TrendingUp } from "lucide-react";

export interface EvidenceMapData {
  sectionName: string;
  evidenceStrength: number; // 0-1 scale
  sourceCount: number;
  assumptionCount: number;
  qualityIssues: Array<{
    type: 'missing_citation' | 'weak_source' | 'assumption' | 'inconsistency';
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
  paragraphs: Array<{
    id: string;
    text: string;
    citationCount: number;
    assumptionCount: number;
    evidenceScore: number;
  }>;
}

interface EvidenceMapProps {
  data: EvidenceMapData[];
  overallGroundingQuality: number;
  onSectionClick?: (sectionName: string) => void;
  className?: string;
}

export function EvidenceMap({ 
  data, 
  overallGroundingQuality, 
  onSectionClick,
  className = "" 
}: EvidenceMapProps) {
  const getEvidenceColor = (strength: number) => {
    if (strength >= 0.85) return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    if (strength >= 0.7) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
  };

  const getEvidenceIcon = (strength: number) => {
    if (strength >= 0.85) return <CheckCircle className="h-4 w-4" />;
    if (strength >= 0.7) return <AlertTriangle className="h-4 w-4" />;
    return <XCircle className="h-4 w-4" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-slate-600';
    }
  };

  const totalSources = data.reduce((sum, section) => sum + section.sourceCount, 0);
  const totalAssumptions = data.reduce((sum, section) => sum + section.assumptionCount, 0);
  const criticalIssues = data.reduce((sum, section) => 
    sum + section.qualityIssues.filter(issue => issue.severity === 'high').length, 0);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Quality Header */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span>Evidence Quality Overview</span>
            </span>
            <Badge className={getEvidenceColor(overallGroundingQuality).bg + ' ' + getEvidenceColor(overallGroundingQuality).text}>
              {Math.round(overallGroundingQuality * 100)}% Grounded
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Grounding Quality</span>
                <span className="font-medium">{Math.round(overallGroundingQuality * 100)}%</span>
              </div>
              <Progress 
                value={overallGroundingQuality * 100} 
                className="h-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Target: ≥85% for high-quality grant applications
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-600">{totalSources}</span>
                </div>
                <p className="text-xs text-slate-600">Sources Used</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-2xl font-bold text-yellow-600">{totalAssumptions}</span>
                </div>
                <p className="text-xs text-slate-600">Assumptions</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">{criticalIssues}</span>
                </div>
                <p className="text-xs text-slate-600">Critical Issues</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section-by-Section Evidence Map */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Section Evidence Analysis</span>
        </h3>
        
        {data.map((section, index) => {
          const evidenceStyle = getEvidenceColor(section.evidenceStrength);
          
          return (
            <Card 
              key={section.sectionName} 
              className={`border cursor-pointer hover:shadow-md transition-shadow ${evidenceStyle.border}`}
              onClick={() => onSectionClick?.(section.sectionName)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {section.sectionName}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    {getEvidenceIcon(section.evidenceStrength)}
                    <span className={`text-sm font-medium ${evidenceStyle.text}`}>
                      {Math.round(section.evidenceStrength * 100)}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div>
                    <Progress 
                      value={section.evidenceStrength * 100} 
                      className="h-2"
                    />
                  </div>

                  {/* Stats */}
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span>{section.sourceCount} sources</span>
                      </span>
                      {section.assumptionCount > 0 && (
                        <span className="flex items-center space-x-1 text-yellow-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{section.assumptionCount} assumptions</span>
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500">
                      {section.paragraphs.length} paragraphs
                    </span>
                  </div>

                  {/* Quality Issues */}
                  {section.qualityIssues.length > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-medium text-slate-700">Issues:</h5>
                      {section.qualityIssues.slice(0, 2).map((issue, issueIndex) => (
                        <div key={issueIndex} className="flex items-start space-x-2">
                          <span className={`text-xs ${getSeverityColor(issue.severity)} mt-0.5`}>
                            •
                          </span>
                          <span className="text-xs text-slate-600">{issue.message}</span>
                        </div>
                      ))}
                      {section.qualityIssues.length > 2 && (
                        <span className="text-xs text-slate-500">
                          +{section.qualityIssues.length - 2} more issues
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recommendations */}
                  {section.recommendations.length > 0 && (
                    <div className="space-y-1">
                      <h5 className="text-xs font-medium text-slate-700">Recommendations:</h5>
                      {section.recommendations.slice(0, 1).map((rec, recIndex) => (
                        <p key={recIndex} className="text-xs text-blue-600">
                          {rec}
                        </p>
                      ))}
                      {section.recommendations.length > 1 && (
                        <span className="text-xs text-slate-500">
                          +{section.recommendations.length - 1} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Overall Recommendations */}
      {data.some(section => section.recommendations.length > 0) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-blue-900">
              Key Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data
                .flatMap(section => section.recommendations)
                .slice(0, 3)
                .map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2 text-sm text-blue-800">
                    <span className="text-blue-600 mt-1">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default EvidenceMap;