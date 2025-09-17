/**
 * Citation System Index - Comprehensive Citation and Evidence Mapping
 * 
 * This module provides a complete citation system for the Granted AI platform,
 * including paragraph-level source attribution, evidence mapping, and quality
 * validation to achieve ≥85% grounding quality.
 * 
 * Key Features:
 * - Paragraph-level citation tracking with semantic similarity
 * - Real-time validation and quality assessment
 * - Evidence Map visualization showing source grounding
 * - Export support with proper citation formatting
 * - Hallucination detection and prevention
 * - Comprehensive testing framework
 * 
 * Usage:
 * ```typescript
 * import { CitationService, generateGrantResponsesWithCitations, EvidenceMap } from '@/lib/citations';
 * 
 * // Generate content with citations
 * const result = await generateGrantResponsesWithCitations({
 *   questions: ['What is your organization\'s mission?'],
 *   organizationId: 'org-123',
 *   useCitations: true
 * });
 * 
 * // Validate citations
 * const citationService = new CitationService();
 * const validation = await citationService.validateCitationsRealTime('paragraph-1');
 * ```
 */

// Core citation types
export type {
  CitationSource,
  ParagraphCitation,
  EvidenceMap,
  ValidationIssue,
  CitationContext,
  CitationSuggestion,
  GroundingAnalysis,
  CitationStats,
  RealTimeValidation,
  CitationHighlight,
  FormattedCitation,
  CitationExportOptions,
  CitationFormat,
  CitationPromptConfig,
  EnhancedGenerationRequest,
  CitationQualityConfig,
  UnsupportedClaim,
  SourceDistribution
} from './types';

// Core citation service
export { CitationService } from './citation-service';

// Enhanced AI generation with citations
export { 
  CitationEnhancedGenerator, 
  generateGrantResponsesWithCitations 
} from './citation-enhanced-generator';

// Citation parsing and validation
export { 
  CitationParser,
  type ParsedContent,
  type ParsedParagraph,
  type ExtractedClaim,
  type ExtractedCitation,
  type ContentValidation
} from './citation-parser';

// Export system with citation preservation
export {
  CitationExportService,
  exportElementToPdfWithCitations,
  exportToDocxWithCitations,
  exportToCopyWithCitations
} from './citation-export';

// Testing framework
export {
  CitationTestingFramework,
  runCitationQualityTest,
  type CitationTestSuite,
  type CitationTest,
  type TestResult,
  type TestSuiteResult,
  type QualityThresholds
} from './citation-testing';

// React components
export { EvidenceMap } from '../../components/citations/EvidenceMap';
export { CitationTooltip, CitationHighlightWrapper, CitationBadge } from '../../components/citations/CitationTooltip';
export { CitationValidationPanel } from '../../components/citations/CitationValidationPanel';

/**
 * Utility function to create a citation service with default configuration
 */
export function createCitationService(options: {
  openaiApiKey?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
} = {}) {
  return new CitationService(
    options.supabaseUrl,
    options.supabaseKey,
    options.openaiApiKey
  );
}

/**
 * Default quality configuration for citations
 */
export const DEFAULT_CITATION_QUALITY_CONFIG: CitationQualityConfig = {
  minimumGroundingQuality: 0.6,
  minimumCitationCoverage: 0.8,
  strongCitationThreshold: 0.8,
  moderateCitationThreshold: 0.6,
  weakCitationThreshold: 0.4,
  hallucinationRiskThreshold: 0.3
};

/**
 * Default export options for citations
 */
export const DEFAULT_CITATION_EXPORT_OPTIONS: CitationExportOptions = {
  format: 'inline',
  style: 'grant_standard',
  includePageNumbers: true,
  includeSectionTitles: true,
  groupByDocument: false
};

/**
 * Comprehensive citation quality check for a draft
 */
export async function performComprehensiveCitationCheck(
  draftId: string,
  questionId: string
): Promise<{
  stats: CitationStats;
  evidenceMap: EvidenceMap;
  validations: RealTimeValidation[];
  recommendations: string[];
}> {
  const citationService = createCitationService();

  const [stats, evidenceMap] = await Promise.all([
    citationService.getDraftCitationStats(draftId),
    citationService.generateEvidenceMap(draftId, questionId)
  ]);

  // Generate recommendations based on quality metrics
  const recommendations: string[] = [];
  
  if (stats.citationCoverage < 80) {
    recommendations.push(`Increase citation coverage from ${Math.round(stats.citationCoverage)}% to at least 80%`);
  }
  
  if (stats.averageGroundingQuality < 0.7) {
    recommendations.push(`Improve average grounding quality from ${Math.round(stats.averageGroundingQuality * 100)}% to at least 70%`);
  }
  
  if (evidenceMap.hallucinationRisk === 'high') {
    recommendations.push('Review content for potential unsupported claims - high hallucination risk detected');
  }
  
  if (evidenceMap.unsupportedClaims.length > 0) {
    recommendations.push(`Address ${evidenceMap.unsupportedClaims.length} unsupported claims requiring evidence`);
  }

  // Mock validation data - in production would fetch actual validations
  const validations: RealTimeValidation[] = [];

  return {
    stats,
    evidenceMap,
    validations,
    recommendations
  };
}

/**
 * Quick citation quality assessment
 */
export function assessCitationQuality(stats: CitationStats): {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  feedback: string;
} {
  const coverageScore = Math.min(stats.citationCoverage / 100, 1.0);
  const groundingScore = stats.averageGroundingQuality;
  const overallScore = (coverageScore * 0.4) + (groundingScore * 0.6);

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  let feedback: string;

  if (overallScore >= 0.9) {
    grade = 'A';
    feedback = 'Excellent citation quality with strong evidence support';
  } else if (overallScore >= 0.8) {
    grade = 'B';
    feedback = 'Good citation quality with minor areas for improvement';
  } else if (overallScore >= 0.7) {
    grade = 'C';
    feedback = 'Acceptable citation quality but needs strengthening';
  } else if (overallScore >= 0.6) {
    grade = 'D';
    feedback = 'Below-standard citation quality requiring significant improvement';
  } else {
    grade = 'F';
    feedback = 'Poor citation quality with major evidence gaps';
  }

  return {
    grade,
    score: Math.round(overallScore * 100),
    feedback
  };
}

/**
 * Export all citation data for a draft
 */
export async function exportCitationData(draftId: string): Promise<{
  paragraphCitations: ParagraphCitation[];
  stats: CitationStats;
  report: string;
}> {
  const citationService = createCitationService();
  
  const stats = await citationService.getDraftCitationStats(draftId);
  // In a real implementation, would fetch paragraph citations from database
  const paragraphCitations: ParagraphCitation[] = [];
  
  const report = generateCitationReport(stats);

  return {
    paragraphCitations,
    stats,
    report
  };
}

function generateCitationReport(stats: CitationStats): string {
  const assessment = assessCitationQuality(stats);
  
  return `
CITATION QUALITY REPORT
========================

Overall Grade: ${assessment.grade} (${assessment.score}%)
Assessment: ${assessment.feedback}

Detailed Metrics:
- Total Paragraphs: ${stats.totalParagraphs}
- Paragraphs with Citations: ${stats.citedParagraphs}
- Citation Coverage: ${Math.round(stats.citationCoverage)}%
- Average Grounding Quality: ${Math.round(stats.averageGroundingQuality * 100)}%
- Total Citations: ${stats.totalSources}
- Unique Source Documents: ${stats.uniqueDocuments}

Recommendations:
${assessment.grade === 'A' ? 
  '- Maintain current citation quality standards\n- Consider this draft as a quality benchmark' :
  assessment.grade === 'B' ?
  '- Minor improvements to achieve excellent quality\n- Focus on strengthening weaker citations' :
  assessment.grade === 'C' ?
  '- Increase citation coverage and source strength\n- Review unsupported claims' :
  '- Significant revision required\n- Add comprehensive source support\n- Review all factual claims for evidence'
}

Generated: ${new Date().toISOString()}
  `.trim();
}