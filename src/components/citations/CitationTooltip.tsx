/**
 * Citation Tooltip Component - Interactive citation preview and validation
 * 
 * Shows citation details, source preview, and validation status when hovering
 * over cited text in the draft editor.
 */

"use client";

import React, { useState } from 'react';
import { CitationSource, CitationHighlight } from '@/lib/citations/types';
import { 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle, 
  ExternalLink,
  Eye
} from 'lucide-react';

interface CitationTooltipProps {
  citationHighlight: CitationHighlight;
  sources: CitationSource[];
  onViewSource?: (sourceId: string) => void;
  onEditCitation?: (citationId: string) => void;
  className?: string;
}

export function CitationTooltip({ 
  citationHighlight, 
  sources,
  onViewSource,
  onEditCitation,
  className = ''
}: CitationTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const getStrengthColor = (strength: 'strong' | 'moderate' | 'weak' | 'unsupported'): string => {
    switch (strength) {
      case 'strong': return 'border-green-500 bg-green-50';
      case 'moderate': return 'border-yellow-500 bg-yellow-50';
      case 'weak': return 'border-orange-500 bg-orange-50';
      case 'unsupported': return 'border-red-500 bg-red-50';
    }
  };

  const getStrengthIcon = (strength: 'strong' | 'moderate' | 'weak' | 'unsupported') => {
    switch (strength) {
      case 'strong': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'moderate': return <CheckCircle className="w-4 h-4 text-yellow-600" />;
      case 'weak': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'unsupported': return <AlertCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const handleMouseEnter = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Find relevant sources for this citation
  const relevantSources = sources.filter(source => 
    citationHighlight.tooltip.sources.some(sourceName => 
      source.sectionTitle?.includes(sourceName) || source.sourceText.includes(sourceName)
    )
  );

  return (
    <>
      {/* Citation highlight span */}
      <span
        className={`
          relative cursor-pointer transition-all duration-200 px-1 rounded
          ${getStrengthColor(citationHighlight.citationStrength).replace('border-', 'bg-').replace('-500', '-100')}
          hover:${getStrengthColor(citationHighlight.citationStrength).replace('bg-', 'bg-').replace('-50', '-200')}
          ${className}
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* This would wrap the actual cited text */}
      </span>

      {/* Tooltip */}
      {isVisible && (
        <div 
          className="fixed z-50 w-80 transform -translate-x-1/2"
          style={{
            left: position.x,
            top: position.y
          }}
        >
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b">
              {getStrengthIcon(citationHighlight.citationStrength)}
              <span className="font-medium text-sm capitalize">
                {citationHighlight.citationStrength} Citation
              </span>
              <div className="ml-auto text-xs text-gray-500">
                {Math.round(citationHighlight.tooltip.similarity * 100)}% similarity
              </div>
            </div>

            {/* Validation Status */}
            <div className={`p-2 rounded-md mb-3 text-xs ${getStrengthColor(citationHighlight.citationStrength)}`}>
              <div className="font-medium mb-1">
                Status: {citationHighlight.tooltip.validationStatus}
              </div>
              <div className="opacity-80">
                {citationHighlight.citationStrength === 'strong' && 'Excellent source support with high similarity.'}
                {citationHighlight.citationStrength === 'moderate' && 'Good source support, could be strengthened.'}
                {citationHighlight.citationStrength === 'weak' && 'Weak source support, consider revision.'}
                {citationHighlight.citationStrength === 'unsupported' && 'No supporting evidence found.'}
              </div>
            </div>

            {/* Sources */}
            <div className="space-y-2">
              <div className="font-medium text-sm text-gray-700 mb-2">
                Supporting Sources ({relevantSources.length})
              </div>
              
              {relevantSources.length > 0 ? (
                relevantSources.slice(0, 3).map((source, index) => (
                  <div key={source.id} className="border rounded p-2 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900">
                          {source.sectionTitle || 'Untitled Section'}
                        </div>
                        {source.pageNumber && (
                          <div className="text-xs text-gray-500">
                            Page {source.pageNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 ml-2">
                        {Math.round(source.similarityScore * 100)}%
                      </div>
                    </div>
                    
                    {/* Source preview */}
                    <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                      "{source.sourceText.slice(0, 120)}..."
                    </div>
                    
                    {/* Citation method */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        source.citationStrength === 'strong' ? 'bg-green-100 text-green-800' :
                        source.citationStrength === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {source.citationMethod}
                      </span>
                      <button
                        onClick={() => onViewSource?.(source.id)}
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No supporting sources found</p>
                  <button
                    onClick={() => onEditCitation?.(citationHighlight.paragraphId)}
                    className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                  >
                    Add citation
                  </button>
                </div>
              )}
              
              {relevantSources.length > 3 && (
                <div className="text-center">
                  <button className="text-blue-600 hover:text-blue-800 text-xs">
                    View {relevantSources.length - 3} more sources
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            {relevantSources.length > 0 && (
              <div className="flex gap-2 mt-3 pt-2 border-t">
                <button
                  onClick={() => onViewSource?.(relevantSources[0].id)}
                  className="flex-1 px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                >
                  View Source
                </button>
                <button
                  onClick={() => onEditCitation?.(citationHighlight.paragraphId)}
                  className="flex-1 px-3 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition-colors"
                >
                  Edit Citation
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Citation Highlight Wrapper - Wraps text segments with citation tooltips
 */
interface CitationHighlightWrapperProps {
  text: string;
  highlights: CitationHighlight[];
  sources: CitationSource[];
  onViewSource?: (sourceId: string) => void;
  onEditCitation?: (citationId: string) => void;
  className?: string;
}

export function CitationHighlightWrapper({
  text,
  highlights,
  sources,
  onViewSource,
  onEditCitation,
  className = ''
}: CitationHighlightWrapperProps) {
  // Sort highlights by position
  const sortedHighlights = [...highlights].sort((a, b) => a.position.start - b.position.start);
  
  if (sortedHighlights.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const segments = [];
  let lastEnd = 0;

  for (let i = 0; i < sortedHighlights.length; i++) {
    const highlight = sortedHighlights[i];
    
    // Add text before highlight
    if (highlight.position.start > lastEnd) {
      segments.push({
        type: 'text',
        content: text.slice(lastEnd, highlight.position.start)
      });
    }
    
    // Add highlighted text
    segments.push({
      type: 'highlight',
      content: text.slice(highlight.position.start, highlight.position.end),
      highlight
    });
    
    lastEnd = highlight.position.end;
  }
  
  // Add remaining text
  if (lastEnd < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastEnd)
    });
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => (
        segment.type === 'highlight' ? (
          <CitationTooltip
            key={index}
            citationHighlight={segment.highlight!}
            sources={sources}
            onViewSource={onViewSource}
            onEditCitation={onEditCitation}
          >
            {segment.content}
          </CitationTooltip>
        ) : (
          <span key={index}>{segment.content}</span>
        )
      ))}
    </span>
  );
}

/**
 * Citation Badge - Displays citation strength indicator
 */
interface CitationBadgeProps {
  strength: 'strong' | 'moderate' | 'weak' | 'unsupported';
  count?: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function CitationBadge({ 
  strength, 
  count, 
  size = 'sm', 
  showLabel = true 
}: CitationBadgeProps) {
  const getConfig = (strength: 'strong' | 'moderate' | 'weak' | 'unsupported') => {
    switch (strength) {
      case 'strong': 
        return { 
          color: 'bg-green-100 text-green-800 border-green-300', 
          icon: CheckCircle,
          label: 'Well Supported'
        };
      case 'moderate': 
        return { 
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300', 
          icon: CheckCircle,
          label: 'Moderately Supported'
        };
      case 'weak': 
        return { 
          color: 'bg-orange-100 text-orange-800 border-orange-300', 
          icon: AlertTriangle,
          label: 'Weakly Supported'
        };
      case 'unsupported': 
        return { 
          color: 'bg-red-100 text-red-800 border-red-300', 
          icon: AlertCircle,
          label: 'Unsupported'
        };
    }
  };

  const config = getConfig(strength);
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${config.color} ${sizeClasses}`}>
      <Icon className={`${size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'}`} />
      {showLabel && <span>{config.label}</span>}
      {count !== undefined && (
        <span className="ml-1 font-medium">({count})</span>
      )}
    </span>
  );
}