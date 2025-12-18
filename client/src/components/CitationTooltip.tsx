import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";

export interface Citation {
  id: number;
  sourceDocumentId: number;
  documentTitle: string;
  pageNumber?: number;
  sectionTitle?: string;
  confidence: number;
  citationText?: string;
  chunkContent: string;
}

interface CitationTooltipProps {
  children: React.ReactNode;
  citations: Citation[];
  className?: string;
}

export function CitationTooltip({ children, citations, className = "" }: CitationTooltipProps) {
  if (citations.length === 0) {
    return <span className={className}>{children}</span>;
  }

  const averageConfidence = citations.reduce((sum, c) => sum + c.confidence, 0) / citations.length;
  const confidenceColor = averageConfidence >= 0.8 ? 'text-green-600' : 
                          averageConfidence >= 0.6 ? 'text-yellow-600' : 'text-red-600';
  const confidenceIcon = averageConfidence >= 0.8 ? CheckCircle : AlertTriangle;
  const ConfidenceIcon = confidenceIcon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${className} relative cursor-help border-b border-dotted border-blue-400 hover:border-blue-600`}>
            {children}
            <sup className="ml-1 text-xs text-blue-600 font-medium">
              [{citations.length}]
            </sup>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Sources ({citations.length})</h4>
            <div className="flex items-center space-x-1">
              <ConfidenceIcon className={`h-4 w-4 ${confidenceColor}`} />
              <span className={`text-xs ${confidenceColor}`}>
                {Math.round(averageConfidence * 100)}% confidence
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            {citations.slice(0, 3).map((citation, index) => (
              <div key={citation.id} className="border-l-2 border-blue-200 pl-3 space-y-1">
                <div className="flex items-start space-x-2">
                  <FileText className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-700">
                      {citation.documentTitle}
                    </p>
                    {citation.sectionTitle && (
                      <p className="text-xs text-slate-500">
                        {citation.sectionTitle}
                        {citation.pageNumber && ` • Page ${citation.pageNumber}`}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(citation.confidence * 100)}%
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-5">
                  {citation.chunkContent.length > 120 
                    ? citation.chunkContent.substring(0, 120) + '...' 
                    : citation.chunkContent
                  }
                </p>
              </div>
            ))}
            
            {citations.length > 3 && (
              <div className="text-xs text-slate-500 text-center pt-2 border-t">
                +{citations.length - 3} more sources
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t">
            <button className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1">
              <ExternalLink className="h-3 w-3" />
              <span>View all citations</span>
            </button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default CitationTooltip;