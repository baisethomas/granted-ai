/**
 * Citation System Types
 * 
 * Comprehensive type definitions for the paragraph-level citation system
 * supporting evidence mapping and grounding quality assessment.
 */

export interface CitationSource {
  id: string;
  paragraphCitationId: string;
  chunkId: string;
  documentId: string;
  textMatch: string;
  sourceText: string;
  similarityScore: number;
  citationStrength: 'strong' | 'moderate' | 'weak';
  positionInParagraph: number;
  citationMethod: 'semantic' | 'exact' | 'paraphrase';
  pageNumber?: number;
  sectionTitle?: string;
  createdAt: Date;
}

export interface ParagraphCitation {
  id: string;
  draftId: string;
  paragraphId: string;
  paragraphText: string;
  paragraphOrder: number;
  totalCitations: number;
  groundingQuality: number; // 0.0 to 1.0
  validationIssues: ValidationIssue[];
  sources: CitationSource[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationIssue {
  type: 'unsupported_claim' | 'weak_citation' | 'potential_hallucination' | 'missing_source';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
  position?: {
    start: number;
    end: number;
  };
}

export interface EvidenceMap {
  id: string;
  draftId: string;
  questionId: string;
  sectionName: string;
  evidenceStrength: number; // 0.0 to 1.0
  sourceCoverage: number; // Percentage 0-100
  hallucinationRisk: 'low' | 'medium' | 'high';
  unsupportedClaims: UnsupportedClaim[];
  sourceDistribution: SourceDistribution[];
  createdAt: Date;
  updatedAt: Date;
}

export interface UnsupportedClaim {
  text: string;
  position: {
    start: number;
    end: number;
  };
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface SourceDistribution {
  documentId: string;
  documentName: string;
  citationCount: number;
  averageSimilarity: number;
  coveragePercentage: number;
}

export interface CitationValidation {
  id: string;
  citationSourceId: string;
  validationType: 'automatic' | 'manual' | 'ai_review';
  isValid: boolean;
  validationScore: number;
  issuesFound: ValidationIssue[];
  validatorNotes?: string;
  validatedBy?: string;
  createdAt: Date;
}

export interface CitationFormat {
  id: string;
  formatName: string;
  inlineTemplate: string;
  bibliographyTemplate: string;
  footnoteTemplate?: string;
  isDefault: boolean;
}

// Analysis and statistics types
export interface CitationStats {
  totalParagraphs: number;
  citedParagraphs: number;
  citationCoverage: number; // Percentage
  averageGroundingQuality: number;
  totalSources: number;
  uniqueDocuments: number;
}

export interface GroundingAnalysis {
  paragraphId: string;
  paragraphText: string;
  groundingQuality: number;
  issueSeverity: 'low' | 'medium' | 'high';
  recommendations: string[];
}

// RAG integration types
export interface CitationContext {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    chunkIndex: number;
  };
}

export interface CitationRequest {
  text: string;
  context: CitationContext[];
  paragraphId: string;
  position: number;
  citationMethod?: 'semantic' | 'exact' | 'paraphrase';
  minimumSimilarity?: number;
}

export interface CitationResponse {
  citations: CitationSource[];
  groundingQuality: number;
  validationIssues: ValidationIssue[];
  suggestions: CitationSuggestion[];
}

export interface CitationSuggestion {
  type: 'add_citation' | 'strengthen_citation' | 'remove_claim' | 'rephrase';
  description: string;
  position: {
    start: number;
    end: number;
  };
  suggestedText?: string;
  sourceRecommendation?: CitationContext;
}

// Export configuration types
export interface CitationExportOptions {
  format: 'inline' | 'footnote' | 'bibliography';
  style: 'apa' | 'mla' | 'chicago' | 'grant_standard';
  includePageNumbers: boolean;
  includeSectionTitles: boolean;
  groupByDocument: boolean;
}

export interface FormattedCitation {
  inlineText: string;
  footnoteText?: string;
  bibliographyEntry: string;
  citationNumber?: number;
}

// Quality thresholds configuration
export interface CitationQualityConfig {
  minimumGroundingQuality: number; // Default: 0.6
  minimumCitationCoverage: number; // Default: 0.8 (80%)
  strongCitationThreshold: number; // Default: 0.8
  moderateCitationThreshold: number; // Default: 0.6
  weakCitationThreshold: number; // Default: 0.4
  hallucinationRiskThreshold: number; // Default: 0.3
}

// AI prompt enhancement types
export interface CitationPromptConfig {
  requireCitations: boolean;
  citationStyle: string;
  evidenceStrengthRequirement: 'high' | 'medium' | 'low';
  maximumClaimsWithoutSource: number;
  preferredSourceTypes: string[];
}

export interface EnhancedGenerationRequest {
  questions: string[];
  contextMemory: string;
  citationConfig: CitationPromptConfig;
  availableSources: CitationContext[];
  tone?: string;
  questionTypes?: string[];
}

// Real-time validation types
export interface RealTimeValidation {
  paragraphId: string;
  validationResults: ValidationIssue[];
  groundingScore: number;
  lastValidated: Date;
  needsRevalidation: boolean;
}

export interface CitationHighlight {
  paragraphId: string;
  position: {
    start: number;
    end: number;
  };
  citationStrength: 'strong' | 'moderate' | 'weak' | 'unsupported';
  tooltip: {
    sources: string[];
    similarity: number;
    validationStatus: string;
  };
}