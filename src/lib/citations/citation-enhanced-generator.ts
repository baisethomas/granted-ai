/**
 * Citation-Enhanced AI Generation System
 * 
 * Enhances the existing grant response generation with citation requirements,
 * source attribution, and evidence-based writing prompts.
 */

import { getLLMProvider } from "../llm";
import { buildOptimizedContext } from '../agent/context';
import { CitationService } from './citation-service';
import { 
  EnhancedGenerationRequest, 
  CitationPromptConfig, 
  CitationContext,
  ParagraphCitation 
} from './types';

export interface CitationEnhancedResponse {
  draft: string;
  paragraphCitations: ParagraphCitation[];
  citationStats: {
    totalParagraphs: number;
    citedParagraphs: number;
    averageGroundingQuality: number;
    overallCitationCoverage: number;
  };
  validationIssues: Array<{
    paragraphId: string;
    issues: string[];
    severity: 'low' | 'medium' | 'high';
  }>;
  sourceUsage: Array<{
    documentId: string;
    documentName: string;
    usageCount: number;
  }>;
}

export class CitationEnhancedGenerator {
  private citationService: CitationService;

  constructor(openaiApiKey?: string, supabaseUrl?: string, supabaseKey?: string) {
    this.citationService = new CitationService(supabaseUrl, supabaseKey, openaiApiKey);
  }

  /**
   * Generate grant responses with comprehensive citation tracking
   */
  async generateWithCitations(params: {
    questions: string[];
    organizationId: string;
    tone?: string;
    citationConfig?: CitationPromptConfig;
    questionTypes?: string[];
    draftId?: string;
  }): Promise<CitationEnhancedResponse> {
    const { 
      questions, 
      organizationId, 
      tone, 
      citationConfig = this.getDefaultCitationConfig(),
      questionTypes = [],
      draftId
    } = params;

    try {
      // Generate enhanced context with citation metadata
      const contextResults = await this.buildCitationAwareContext(
        questions, 
        organizationId, 
        questionTypes
      );

      // Create citation-enhanced prompt
      const enhancedPrompt = this.createCitationEnhancedPrompt(
        questions,
        contextResults.contextMemory,
        contextResults.availableSources,
        citationConfig,
        tone
      );

      // Generate draft with citation awareness
      const provider = getLLMProvider();
      const rawDraft = await provider.generate({
        instructions: enhancedPrompt.instructions,
        questions,
        context: enhancedPrompt.context,
        tone,
        maxTokens: 2500 // Increased for citation content
      });

      // Parse the draft into paragraphs and generate citations
      const paragraphs = this.parseDraftIntoParagraphs(rawDraft);
      const paragraphCitations: ParagraphCitation[] = [];
      const validationIssues: Array<{
        paragraphId: string;
        issues: string[];
        severity: 'low' | 'medium' | 'high';
      }> = [];

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        const paragraphId = `${draftId || 'temp'}-p${i}`;

        // Generate citations for this paragraph
        const citationResponse = await this.citationService.generateCitationsForParagraph({
          text: paragraph.text,
          context: contextResults.availableSources,
          paragraphId,
          position: paragraph.startPosition,
          minimumSimilarity: 0.6
        });

        // Save citations if we have a draft ID
        if (draftId) {
          const savedCitation = await this.citationService.saveParagraphCitations(
            draftId,
            paragraphId,
            paragraph.text,
            i,
            citationResponse
          );
          paragraphCitations.push(savedCitation);
        } else {
          // Create temporary citation object for preview
          paragraphCitations.push({
            id: paragraphId,
            draftId: draftId || 'temp',
            paragraphId,
            paragraphText: paragraph.text,
            paragraphOrder: i,
            totalCitations: citationResponse.citations.length,
            groundingQuality: citationResponse.groundingQuality,
            validationIssues: citationResponse.validationIssues,
            sources: citationResponse.citations,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Collect validation issues
        if (citationResponse.validationIssues.length > 0) {
          validationIssues.push({
            paragraphId,
            issues: citationResponse.validationIssues.map(issue => issue.description),
            severity: this.determineParagraphSeverity(citationResponse.validationIssues)
          });
        }
      }

      // Calculate overall statistics
      const citationStats = this.calculateCitationStats(paragraphCitations);
      const sourceUsage = this.calculateSourceUsage(paragraphCitations, contextResults.availableSources);

      return {
        draft: rawDraft,
        paragraphCitations,
        citationStats,
        validationIssues,
        sourceUsage
      };

    } catch (error) {
      console.error('Error in citation-enhanced generation:', error);
      throw new Error(`Citation-enhanced generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build context with citation metadata for each source
   */
  private async buildCitationAwareContext(
    questions: string[], 
    organizationId: string, 
    questionTypes: string[]
  ): Promise<{
    contextMemory: string;
    availableSources: CitationContext[];
  }> {
    let contextMemory = '';
    const availableSources: CitationContext[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const questionType = questionTypes[i];

      const contextResult = await buildOptimizedContext(
        question,
        organizationId,
        questionType
      );

      contextMemory += contextResult.context + '\n\n---\n\n';

      // Extract source metadata for citation tracking
      if (contextResult.sources) {
        for (const source of contextResult.sources) {
          availableSources.push({
            chunkId: source.id,
            documentId: source.documentId,
            content: source.content,
            similarity: source.similarity,
            metadata: {
              pageNumber: source.pageNumber,
              sectionTitle: source.sectionTitle,
              chunkIndex: source.chunkIndex
            }
          });
        }
      }
    }

    return { contextMemory, availableSources };
  }

  /**
   * Create enhanced prompt that requires citations
   */
  private createCitationEnhancedPrompt(
    questions: string[],
    context: string,
    availableSources: CitationContext[],
    config: CitationPromptConfig,
    tone?: string
  ): { instructions: string; context: string } {
    const sourceList = availableSources
      .map((source, index) => `[Source ${index + 1}]: ${source.metadata.sectionTitle || 'Untitled'} (${source.content.slice(0, 100)}...)`)
      .join('\n');

    const instructions = `
You are an expert grant writer creating evidence-based responses with proper source attribution.

CRITICAL CITATION REQUIREMENTS:
1. Every factual claim, statistic, or specific statement MUST be supported by evidence from the provided sources
2. Use clear, professional language that demonstrates deep knowledge of the source materials
3. Ensure each paragraph has strong grounding in the available evidence
4. When making claims, base them directly on the provided context and sources
5. If information is not available in the sources, clearly indicate this rather than making unsupported claims

EVIDENCE STANDARDS:
- Strong evidence: Direct quotes or specific data from sources
- Moderate evidence: Clear paraphrasing with obvious source connection  
- Weak evidence: General concepts that loosely relate to sources
- Avoid any unsupported claims or "hallucinated" information

WRITING GUIDELINES:
- Tone: ${tone || 'Professional and authoritative'}
- Evidence strength requirement: ${config.evidenceStrengthRequirement}
- Maximum unsupported claims: ${config.maximumClaimsWithoutSource}
- Preferred citation style: ${config.citationStyle}

AVAILABLE SOURCES:
${sourceList}

When writing responses, ensure that every significant claim can be traced back to the provided sources. Focus on creating compelling, evidence-based narratives that demonstrate your organization's credibility and capacity.

Generate complete, well-structured responses to each question while maintaining the highest standards of evidence-based writing.
    `;

    return { instructions, context };
  }

  /**
   * Parse draft into individual paragraphs for citation analysis
   */
  private parseDraftIntoParagraphs(draft: string): Array<{
    text: string;
    startPosition: number;
    endPosition: number;
  }> {
    const paragraphs = draft.split(/\n\s*\n/).filter(p => p.trim().length > 50); // Minimum paragraph length
    const result = [];
    let position = 0;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed.length > 0) {
        const startPosition = draft.indexOf(trimmed, position);
        const endPosition = startPosition + trimmed.length;
        
        result.push({
          text: trimmed,
          startPosition,
          endPosition
        });
        
        position = endPosition;
      }
    }

    return result;
  }

  /**
   * Calculate overall citation statistics
   */
  private calculateCitationStats(paragraphCitations: ParagraphCitation[]): {
    totalParagraphs: number;
    citedParagraphs: number;
    averageGroundingQuality: number;
    overallCitationCoverage: number;
  } {
    const totalParagraphs = paragraphCitations.length;
    const citedParagraphs = paragraphCitations.filter(p => p.totalCitations > 0).length;
    const averageGroundingQuality = totalParagraphs > 0 
      ? paragraphCitations.reduce((sum, p) => sum + p.groundingQuality, 0) / totalParagraphs 
      : 0;
    const overallCitationCoverage = totalParagraphs > 0 
      ? (citedParagraphs / totalParagraphs) * 100 
      : 0;

    return {
      totalParagraphs,
      citedParagraphs,
      averageGroundingQuality,
      overallCitationCoverage
    };
  }

  /**
   * Calculate source usage statistics
   */
  private calculateSourceUsage(
    paragraphCitations: ParagraphCitation[], 
    availableSources: CitationContext[]
  ): Array<{
    documentId: string;
    documentName: string;
    usageCount: number;
  }> {
    const usageMap = new Map<string, { name: string; count: number }>();

    // Count usage from citations
    for (const paragraph of paragraphCitations) {
      for (const source of paragraph.sources) {
        const existing = usageMap.get(source.documentId);
        if (existing) {
          existing.count++;
        } else {
          // Find document name from available sources
          const sourceContext = availableSources.find(s => s.documentId === source.documentId);
          usageMap.set(source.documentId, {
            name: sourceContext?.metadata.sectionTitle || 'Unknown Document',
            count: 1
          });
        }
      }
    }

    return Array.from(usageMap.entries()).map(([documentId, data]) => ({
      documentId,
      documentName: data.name,
      usageCount: data.count
    })).sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Determine severity level for paragraph validation issues
   */
  private determineParagraphSeverity(issues: Array<{ severity: 'low' | 'medium' | 'high' }>): 'low' | 'medium' | 'high' {
    if (issues.some(issue => issue.severity === 'high')) return 'high';
    if (issues.some(issue => issue.severity === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Get default citation configuration
   */
  private getDefaultCitationConfig(): CitationPromptConfig {
    return {
      requireCitations: true,
      citationStyle: 'grant_standard',
      evidenceStrengthRequirement: 'high',
      maximumClaimsWithoutSource: 1,
      preferredSourceTypes: ['organization-profile', 'program', 'budget', 'assessment']
    };
  }
}

/**
 * Enhanced generation function that integrates with existing API
 */
export async function generateGrantResponsesWithCitations(params: {
  questions: string[];
  organizationId: string;
  tone?: string;
  providerName?: string;
  draftId?: string;
  questionTypes?: string[];
}): Promise<CitationEnhancedResponse> {
  const generator = new CitationEnhancedGenerator();
  
  return await generator.generateWithCitations({
    questions: params.questions,
    organizationId: params.organizationId,
    tone: params.tone,
    questionTypes: params.questionTypes,
    draftId: params.draftId
  });
}