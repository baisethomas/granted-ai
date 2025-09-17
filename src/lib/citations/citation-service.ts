/**
 * Citation Service - Core service for paragraph-level source attribution
 * 
 * Provides comprehensive citation tracking, validation, and grounding quality analysis
 * for the Granted AI platform. Integrates with the existing RAG system to provide
 * evidence-based writing with proper source attribution.
 */

import { createClient } from '@supabase/supabase-js';
import { 
  CitationSource, 
  ParagraphCitation, 
  EvidenceMap, 
  CitationRequest, 
  CitationResponse, 
  CitationStats, 
  GroundingAnalysis,
  ValidationIssue,
  CitationContext,
  CitationSuggestion,
  RealTimeValidation,
  CitationQualityConfig
} from './types';
import { VectorRetrievalService } from '../rag/retrieval';
import { EmbeddingService } from '../rag/embeddings';

export class CitationService {
  private supabase;
  private retrievalService: VectorRetrievalService;
  private qualityConfig: CitationQualityConfig;

  constructor(
    supabaseUrl?: string, 
    supabaseKey?: string,
    openaiApiKey?: string
  ) {
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const embeddingService = new EmbeddingService(openaiApiKey);
    this.retrievalService = new VectorRetrievalService(embeddingService);

    this.qualityConfig = {
      minimumGroundingQuality: 0.6,
      minimumCitationCoverage: 0.8,
      strongCitationThreshold: 0.8,
      moderateCitationThreshold: 0.6,
      weakCitationThreshold: 0.4,
      hallucinationRiskThreshold: 0.3
    };
  }

  /**
   * Generate citations for a text paragraph using RAG context
   */
  async generateCitationsForParagraph(request: CitationRequest): Promise<CitationResponse> {
    try {
      const { text, context, paragraphId, position, citationMethod = 'semantic', minimumSimilarity = 0.6 } = request;

      const citations: CitationSource[] = [];
      const validationIssues: ValidationIssue[] = [];
      const suggestions: CitationSuggestion[] = [];

      // Analyze text for claims that need citations
      const claims = await this.extractClaimsFromText(text);
      
      let totalSimilarity = 0;
      let citationCount = 0;

      for (const claim of claims) {
        // Find best matching sources for this claim
        const bestMatches = await this.findBestSourcesForClaim(claim, context);
        
        for (const match of bestMatches) {
          if (match.similarity >= minimumSimilarity) {
            const citation: CitationSource = {
              id: crypto.randomUUID(),
              paragraphCitationId: '', // Will be set when saving
              chunkId: match.chunkId,
              documentId: match.documentId,
              textMatch: claim.text,
              sourceText: match.content,
              similarityScore: match.similarity,
              citationStrength: this.determineCitationStrength(match.similarity),
              positionInParagraph: claim.position.start,
              citationMethod,
              pageNumber: match.metadata.pageNumber,
              sectionTitle: match.metadata.sectionTitle,
              createdAt: new Date()
            };

            citations.push(citation);
            totalSimilarity += match.similarity;
            citationCount++;
          } else {
            // Flag potential unsupported claim
            validationIssues.push({
              type: 'unsupported_claim',
              severity: 'medium',
              description: `Claim "${claim.text}" has low source support (${Math.round(match.similarity * 100)}%)`,
              suggestion: 'Consider rephrasing or adding more specific evidence',
              position: claim.position
            });
          }
        }

        // If no good matches found for a factual claim
        if (bestMatches.length === 0 && claim.type === 'factual') {
          validationIssues.push({
            type: 'missing_source',
            severity: 'high',
            description: `Factual claim "${claim.text}" needs supporting evidence`,
            suggestion: 'Add a citation or rephrase as opinion/general statement',
            position: claim.position
          });

          suggestions.push({
            type: 'add_citation',
            description: 'This claim needs supporting evidence from your uploaded documents',
            position: claim.position,
            sourceRecommendation: await this.suggestBestSource(claim.text, context)
          });
        }
      }

      const groundingQuality = citationCount > 0 ? totalSimilarity / citationCount : 0;

      // Add suggestion for low grounding quality
      if (groundingQuality < this.qualityConfig.minimumGroundingQuality) {
        suggestions.push({
          type: 'strengthen_citation',
          description: `Paragraph grounding quality is ${Math.round(groundingQuality * 100)}%. Consider adding stronger evidence.`,
          position: { start: 0, end: text.length }
        });
      }

      return {
        citations,
        groundingQuality,
        validationIssues,
        suggestions
      };

    } catch (error) {
      console.error('Error generating citations:', error);
      throw new Error(`Citation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save paragraph citations to database
   */
  async saveParagraphCitations(
    draftId: string, 
    paragraphId: string, 
    paragraphText: string, 
    paragraphOrder: number,
    citationResponse: CitationResponse
  ): Promise<ParagraphCitation> {
    try {
      // Create paragraph citation record
      const { data: paragraphCitation, error: paragraphError } = await this.supabase
        .from('paragraph_citations')
        .insert({
          draft_id: draftId,
          paragraph_id: paragraphId,
          paragraph_text: paragraphText,
          paragraph_order: paragraphOrder,
          total_citations: citationResponse.citations.length,
          grounding_quality: citationResponse.groundingQuality,
          validation_issues: citationResponse.validationIssues
        })
        .select()
        .single();

      if (paragraphError) throw paragraphError;

      // Save individual citations
      const citationSources = citationResponse.citations.map(citation => ({
        paragraph_citation_id: paragraphCitation.id,
        chunk_id: citation.chunkId,
        document_id: citation.documentId,
        text_match: citation.textMatch,
        source_text: citation.sourceText,
        similarity_score: citation.similarityScore,
        citation_strength: citation.citationStrength,
        position_in_paragraph: citation.positionInParagraph,
        citation_method: citation.citationMethod,
        page_number: citation.pageNumber,
        section_title: citation.sectionTitle
      }));

      if (citationSources.length > 0) {
        const { error: sourcesError } = await this.supabase
          .from('citation_sources')
          .insert(citationSources);

        if (sourcesError) throw sourcesError;
      }

      return {
        id: paragraphCitation.id,
        draftId,
        paragraphId,
        paragraphText,
        paragraphOrder,
        totalCitations: citationResponse.citations.length,
        groundingQuality: citationResponse.groundingQuality,
        validationIssues: citationResponse.validationIssues,
        sources: citationResponse.citations,
        createdAt: new Date(paragraphCitation.created_at),
        updatedAt: new Date(paragraphCitation.updated_at || paragraphCitation.created_at)
      };

    } catch (error) {
      console.error('Error saving paragraph citations:', error);
      throw new Error(`Failed to save citations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get citation statistics for a draft
   */
  async getDraftCitationStats(draftId: string): Promise<CitationStats> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_draft_citation_stats', { draft_id: draftId });

      if (error) throw error;

      const stats = data[0];
      return {
        totalParagraphs: parseInt(stats.total_paragraphs),
        citedParagraphs: parseInt(stats.cited_paragraphs),
        citationCoverage: parseFloat(stats.citation_coverage),
        averageGroundingQuality: parseFloat(stats.avg_grounding_quality),
        totalSources: parseInt(stats.total_sources),
        uniqueDocuments: parseInt(stats.unique_documents)
      };

    } catch (error) {
      console.error('Error getting citation stats:', error);
      throw new Error(`Failed to get citation stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Identify unsupported claims in a draft
   */
  async identifyUnsupportedClaims(
    draftId: string, 
    threshold: number = this.qualityConfig.minimumGroundingQuality
  ): Promise<GroundingAnalysis[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('identify_unsupported_claims', { 
          draft_id: draftId, 
          min_grounding_threshold: threshold 
        });

      if (error) throw error;

      return data.map((item: any) => ({
        paragraphId: item.paragraph_id,
        paragraphText: item.paragraph_text,
        groundingQuality: parseFloat(item.grounding_quality),
        issueSeverity: item.issue_severity,
        recommendations: this.generateRecommendations(item.issue_severity, parseFloat(item.grounding_quality))
      }));

    } catch (error) {
      console.error('Error identifying unsupported claims:', error);
      throw new Error(`Failed to identify unsupported claims: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate evidence map for a draft
   */
  async generateEvidenceMap(draftId: string, questionId: string): Promise<EvidenceMap> {
    try {
      // Get paragraph citations for the draft
      const { data: paragraphs, error: paragraphsError } = await this.supabase
        .from('paragraph_citations')
        .select(`
          *,
          citation_sources (*)
        `)
        .eq('draft_id', draftId);

      if (paragraphsError) throw paragraphsError;

      // Get source distribution
      const { data: sourceDistribution, error: sourceError } = await this.supabase
        .rpc('get_source_distribution', { draft_id: draftId });

      if (sourceError) throw sourceError;

      // Calculate evidence metrics
      const totalParagraphs = paragraphs.length;
      const citedParagraphs = paragraphs.filter(p => p.total_citations > 0).length;
      const sourceCoverage = totalParagraphs > 0 ? (citedParagraphs / totalParagraphs) * 100 : 0;
      
      const avgGroundingQuality = paragraphs.length > 0 
        ? paragraphs.reduce((sum, p) => sum + p.grounding_quality, 0) / paragraphs.length 
        : 0;

      const evidenceStrength = avgGroundingQuality;
      
      // Determine hallucination risk
      const lowQualityCount = paragraphs.filter(p => p.grounding_quality < this.qualityConfig.hallucinationRiskThreshold).length;
      const hallucinationRisk = lowQualityCount > totalParagraphs * 0.3 ? 'high' : 
                               lowQualityCount > totalParagraphs * 0.1 ? 'medium' : 'low';

      // Identify unsupported claims
      const unsupportedClaims = paragraphs
        .filter(p => p.grounding_quality < this.qualityConfig.minimumGroundingQuality)
        .map(p => ({
          text: p.paragraph_text.slice(0, 100) + '...',
          position: { start: 0, end: p.paragraph_text.length },
          severity: p.grounding_quality < 0.3 ? 'high' as const : 
                   p.grounding_quality < 0.6 ? 'medium' as const : 'low' as const,
          reason: `Low grounding quality: ${Math.round(p.grounding_quality * 100)}%`
        }));

      // Create evidence map record
      const evidenceMap = {
        id: crypto.randomUUID(),
        draftId,
        questionId,
        sectionName: 'Generated Response', // Could be enhanced to detect sections
        evidenceStrength,
        sourceCoverage,
        hallucinationRisk,
        unsupportedClaims,
        sourceDistribution: sourceDistribution.map((item: any) => ({
          documentId: item.document_id,
          documentName: item.document_name,
          citationCount: parseInt(item.citation_count),
          averageSimilarity: parseFloat(item.avg_similarity),
          coveragePercentage: parseFloat(item.coverage_percentage)
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save evidence map to database
      const { error: saveError } = await this.supabase
        .from('evidence_maps')
        .insert({
          id: evidenceMap.id,
          draft_id: draftId,
          question_id: questionId,
          section_name: evidenceMap.sectionName,
          evidence_strength: evidenceMap.evidenceStrength,
          source_coverage: evidenceMap.sourceCoverage,
          hallucination_risk: evidenceMap.hallucinationRisk,
          unsupported_claims: evidenceMap.unsupportedClaims,
          source_distribution: evidenceMap.sourceDistribution
        });

      if (saveError) throw saveError;

      return evidenceMap;

    } catch (error) {
      console.error('Error generating evidence map:', error);
      throw new Error(`Failed to generate evidence map: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate citations in real-time
   */
  async validateCitationsRealTime(paragraphId: string): Promise<RealTimeValidation> {
    try {
      // Get paragraph citation data
      const { data: paragraphData, error } = await this.supabase
        .from('paragraph_citations')
        .select(`
          *,
          citation_sources (*)
        `)
        .eq('paragraph_id', paragraphId)
        .single();

      if (error) throw error;

      const validationResults: ValidationIssue[] = [];

      // Check grounding quality
      if (paragraphData.grounding_quality < this.qualityConfig.minimumGroundingQuality) {
        validationResults.push({
          type: 'weak_citation',
          severity: paragraphData.grounding_quality < 0.3 ? 'high' : 'medium',
          description: `Low grounding quality: ${Math.round(paragraphData.grounding_quality * 100)}%`,
          suggestion: 'Consider adding stronger evidence or rephrasing claims'
        });
      }

      // Check for potential hallucinations
      if (paragraphData.grounding_quality < this.qualityConfig.hallucinationRiskThreshold) {
        validationResults.push({
          type: 'potential_hallucination',
          severity: 'high',
          description: 'This paragraph may contain unsupported claims',
          suggestion: 'Review all claims and ensure they are backed by your uploaded documents'
        });
      }

      return {
        paragraphId,
        validationResults,
        groundingScore: paragraphData.grounding_quality,
        lastValidated: new Date(),
        needsRevalidation: validationResults.length > 0
      };

    } catch (error) {
      console.error('Error in real-time validation:', error);
      throw new Error(`Real-time validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async extractClaimsFromText(text: string): Promise<Array<{text: string, type: 'factual' | 'opinion', position: {start: number, end: number}}>> {
    // Simple claim extraction - in production, this could use NLP
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const claims = [];
    
    let position = 0;
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 0) {
        const start = text.indexOf(trimmed, position);
        const end = start + trimmed.length;
        
        // Determine if claim is factual (needs citation) or opinion
        const type = this.isFactualClaim(trimmed) ? 'factual' : 'opinion';
        
        claims.push({
          text: trimmed,
          type,
          position: { start, end }
        });
        
        position = end;
      }
    }
    
    return claims;
  }

  private isFactualClaim(text: string): boolean {
    // Simple heuristics for factual claims - could be enhanced with ML
    const factualIndicators = [
      /\d+%/,  // Percentages
      /\$[\d,]+/, // Money amounts
      /\d{4}/, // Years
      /according to/i,
      /research shows/i,
      /studies indicate/i,
      /data reveals/i,
      /statistics show/i
    ];
    
    return factualIndicators.some(indicator => indicator.test(text));
  }

  private async findBestSourcesForClaim(claim: {text: string}, context: CitationContext[]): Promise<CitationContext[]> {
    // Sort by similarity and return top matches
    return context
      .filter(ctx => ctx.similarity >= 0.4) // Minimum threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3); // Top 3 matches per claim
  }

  private determineCitationStrength(similarity: number): 'strong' | 'moderate' | 'weak' {
    if (similarity >= this.qualityConfig.strongCitationThreshold) return 'strong';
    if (similarity >= this.qualityConfig.moderateCitationThreshold) return 'moderate';
    return 'weak';
  }

  private async suggestBestSource(claimText: string, context: CitationContext[]): Promise<CitationContext | undefined> {
    // Return the best matching context for a claim
    return context
      .sort((a, b) => b.similarity - a.similarity)[0];
  }

  private generateRecommendations(severity: string, groundingQuality: number): string[] {
    const recommendations = [];
    
    if (groundingQuality < 0.3) {
      recommendations.push('This paragraph needs significant strengthening with evidence from your documents');
      recommendations.push('Consider breaking complex claims into separate, well-supported statements');
    } else if (groundingQuality < 0.6) {
      recommendations.push('Add more specific evidence to support the claims in this paragraph');
      recommendations.push('Review source documents for more relevant supporting information');
    }
    
    if (severity === 'high') {
      recommendations.push('High priority: Review and revise this content before submission');
    }
    
    return recommendations;
  }
}