/**
 * Citation Parser and Validation System
 * 
 * Handles parsing of AI-generated content to extract citations, validate
 * source attributions, and ensure grounding quality meets standards.
 */

import { 
  CitationSource, 
  ValidationIssue, 
  CitationContext, 
  CitationValidation,
  FormattedCitation,
  CitationExportOptions 
} from './types';

export interface ParsedContent {
  paragraphs: ParsedParagraph[];
  citations: ExtractedCitation[];
  validationResults: ContentValidation;
}

export interface ParsedParagraph {
  id: string;
  text: string;
  order: number;
  claims: ExtractedClaim[];
  citationCount: number;
  groundingScore: number;
}

export interface ExtractedClaim {
  text: string;
  type: 'factual' | 'opinion' | 'statistical' | 'methodological';
  position: { start: number; end: number };
  confidence: number;
  needsCitation: boolean;
  suggestedSources?: CitationContext[];
}

export interface ExtractedCitation {
  id: string;
  paragraphId: string;
  claimText: string;
  sourceReference: string;
  citationType: 'inline' | 'implicit' | 'numerical';
  position: { start: number; end: number };
  validation: {
    isValid: boolean;
    confidence: number;
    issues: string[];
  };
}

export interface ContentValidation {
  overallScore: number;
  citationCoverage: number;
  hallucinationRisk: 'low' | 'medium' | 'high';
  issues: ValidationIssue[];
  suggestions: string[];
}

export class CitationParser {
  private factualIndicators = [
    // Statistical patterns
    /\d+\.?\d*\s*%/g,                    // Percentages: 25%, 13.5%
    /\$[\d,]+\.?\d*/g,                   // Money: $1,000, $500.50
    /\b\d{4}\b/g,                        // Years: 2023, 1995
    /\b\d+\s*(million|billion|thousand)/gi, // Large numbers: 5 million
    
    // Authority patterns
    /according to\s+[^.]+/gi,            // "according to [source]"
    /research\s+(shows|indicates|demonstrates)/gi,
    /studies?\s+(show|indicate|demonstrate|reveal)/gi,
    /data\s+(shows|indicates|demonstrates|reveals)/gi,
    /report\s+(shows|indicates|states)/gi,
    /survey\s+(shows|found|indicates)/gi,
    
    // Specific claim patterns
    /evidence\s+suggests?/gi,
    /findings\s+(show|indicate)/gi,
    /analysis\s+(shows|reveals|indicates)/gi,
    /(research|study|analysis|data)\s+from\s+/gi,
  ];

  private citationPatterns = [
    // Common citation formats
    /\([^)]*\d{4}[^)]*\)/g,              // (Author 2023) or (Source, 2023)
    /\[[^\]]*\]/g,                       // [1], [Source], [Document Name]
    /\(see\s+[^)]+\)/gi,                 // (see Document Name)
    /\(cf\.\s+[^)]+\)/gi,                // (cf. Source)
    /"[^"]+"\s*\([^)]+\)/g,              // "Quote" (Source)
    /as\s+(noted|stated|mentioned)\s+in\s+[^.]+/gi, // as noted in [source]
  ];

  /**
   * Parse AI-generated content for citations and claims
   */
  parseContent(content: string, availableSources: CitationContext[]): ParsedContent {
    const paragraphs = this.extractParagraphs(content);
    const parsedParagraphs: ParsedParagraph[] = [];
    const extractedCitations: ExtractedCitation[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraphText = paragraphs[i];
      const paragraphId = `para-${i}`;

      // Extract claims from paragraph
      const claims = this.extractClaims(paragraphText, i * 1000); // Offset positions

      // Extract existing citations
      const citations = this.extractCitations(paragraphText, paragraphId, i * 1000);
      extractedCitations.push(...citations);

      // Calculate grounding score
      const groundingScore = this.calculateParagraphGrounding(
        claims, 
        citations, 
        availableSources
      );

      parsedParagraphs.push({
        id: paragraphId,
        text: paragraphText,
        order: i,
        claims,
        citationCount: citations.length,
        groundingScore
      });
    }

    // Validate overall content
    const validationResults = this.validateContent(parsedParagraphs, extractedCitations);

    return {
      paragraphs: parsedParagraphs,
      citations: extractedCitations,
      validationResults
    };
  }

  /**
   * Validate parsed citations against available sources
   */
  async validateCitations(
    citations: ExtractedCitation[],
    availableSources: CitationContext[]
  ): Promise<CitationValidation[]> {
    const validations: CitationValidation[] = [];

    for (const citation of citations) {
      const validation = await this.validateSingleCitation(citation, availableSources);
      validations.push(validation);
    }

    return validations;
  }

  /**
   * Format citations for export
   */
  formatCitationsForExport(
    citations: CitationSource[],
    options: CitationExportOptions
  ): FormattedCitation[] {
    const formatted: FormattedCitation[] = [];

    for (let i = 0; i < citations.length; i++) {
      const citation = citations[i];
      const citationNumber = i + 1;

      const formattedCitation: FormattedCitation = {
        inlineText: this.formatInlineCitation(citation, options, citationNumber),
        bibliographyEntry: this.formatBibliographyEntry(citation, options),
        citationNumber: options.format === 'footnote' ? citationNumber : undefined
      };

      if (options.format === 'footnote') {
        formattedCitation.footnoteText = this.formatFootnote(citation, options, citationNumber);
      }

      formatted.push(formattedCitation);
    }

    return formatted;
  }

  /**
   * Generate citation suggestions for uncited claims
   */
  generateCitationSuggestions(
    claims: ExtractedClaim[],
    availableSources: CitationContext[]
  ): Array<{
    claim: ExtractedClaim;
    suggestedSources: CitationContext[];
    confidence: number;
  }> {
    const suggestions = [];

    for (const claim of claims.filter(c => c.needsCitation)) {
      const suggestedSources = this.findMatchingSources(claim, availableSources);
      const confidence = this.calculateSuggestionConfidence(claim, suggestedSources);

      if (suggestedSources.length > 0) {
        suggestions.push({
          claim,
          suggestedSources: suggestedSources.slice(0, 3), // Top 3 suggestions
          confidence
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // Private helper methods

  private extractParagraphs(content: string): string[] {
    return content
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 50); // Minimum paragraph length
  }

  private extractClaims(text: string, baseOffset: number): ExtractedClaim[] {
    const claims: ExtractedClaim[] = [];
    
    // Split into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    let position = 0;

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) continue;

      const start = text.indexOf(trimmed, position);
      if (start === -1) continue;

      const end = start + trimmed.length;
      
      // Determine claim type and if citation is needed
      const claimType = this.determineClaimType(trimmed);
      const needsCitation = this.doesClaimNeedCitation(trimmed, claimType);
      const confidence = this.calculateClaimConfidence(trimmed, claimType);

      claims.push({
        text: trimmed,
        type: claimType,
        position: { start: baseOffset + start, end: baseOffset + end },
        confidence,
        needsCitation
      });

      position = end;
    }

    return claims;
  }

  private extractCitations(text: string, paragraphId: string, baseOffset: number): ExtractedCitation[] {
    const citations: ExtractedCitation[] = [];
    
    for (const pattern of this.citationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const citationText = match[0];
        const start = match.index;
        const end = start + citationText.length;

        // Determine citation type
        const citationType = this.determineCitationType(citationText);
        
        // Extract claim text (surrounding context)
        const claimText = this.extractClaimForCitation(text, start);

        citations.push({
          id: `${paragraphId}-cite-${citations.length}`,
          paragraphId,
          claimText,
          sourceReference: citationText,
          citationType,
          position: { start: baseOffset + start, end: baseOffset + end },
          validation: {
            isValid: true, // Will be validated separately
            confidence: 0.8,
            issues: []
          }
        });
      }
    }

    return citations;
  }

  private determineClaimType(text: string): 'factual' | 'opinion' | 'statistical' | 'methodological' {
    const lowerText = text.toLowerCase();
    
    // Statistical claims
    if (this.factualIndicators.slice(0, 4).some(pattern => pattern.test(text))) {
      return 'statistical';
    }
    
    // Methodological claims
    if (/\b(approach|method|process|procedure|implement|develop)\b/i.test(lowerText)) {
      return 'methodological';
    }
    
    // Factual claims
    if (this.factualIndicators.some(pattern => pattern.test(text))) {
      return 'factual';
    }
    
    // Opinion/subjective claims
    if (/\b(believe|think|feel|opinion|perspective|view)\b/i.test(lowerText)) {
      return 'opinion';
    }
    
    return 'factual'; // Default
  }

  private doesClaimNeedCitation(text: string, type: 'factual' | 'opinion' | 'statistical' | 'methodological'): boolean {
    // Statistical and specific factual claims always need citations
    if (type === 'statistical') return true;
    
    // Factual claims with specific data need citations
    if (type === 'factual' && this.factualIndicators.some(pattern => pattern.test(text))) {
      return true;
    }
    
    // Methodological claims about specific approaches need citations
    if (type === 'methodological' && /\b(research shows|studies indicate|proven|effective)\b/i.test(text)) {
      return true;
    }
    
    // Opinion claims generally don't need citations unless they reference external sources
    if (type === 'opinion') return false;
    
    return false;
  }

  private calculateClaimConfidence(text: string, type: string): number {
    // Higher confidence for more specific claims
    if (this.factualIndicators.slice(0, 4).some(pattern => pattern.test(text))) {
      return 0.9; // Statistical data
    }
    
    if (this.factualIndicators.slice(4).some(pattern => pattern.test(text))) {
      return 0.8; // Authority references
    }
    
    if (type === 'factual') return 0.7;
    if (type === 'methodological') return 0.6;
    
    return 0.4; // Opinion/general
  }

  private determineCitationType(citationText: string): 'inline' | 'implicit' | 'numerical' {
    if (/\[\d+\]/.test(citationText)) return 'numerical';
    if (/\([^)]*\d{4}[^)]*\)/.test(citationText)) return 'inline';
    return 'implicit';
  }

  private extractClaimForCitation(text: string, citationStart: number): string {
    // Extract the sentence containing the citation
    const beforeCitation = text.substring(0, citationStart);
    const afterCitation = text.substring(citationStart);
    
    const sentenceStart = Math.max(
      beforeCitation.lastIndexOf('.'),
      beforeCitation.lastIndexOf('!'),
      beforeCitation.lastIndexOf('?')
    ) + 1;
    
    const sentenceEnd = Math.min(
      afterCitation.indexOf('.') + citationStart,
      afterCitation.indexOf('!') + citationStart,
      afterCitation.indexOf('?') + citationStart
    );
    
    return text.substring(sentenceStart, sentenceEnd).trim();
  }

  private calculateParagraphGrounding(
    claims: ExtractedClaim[],
    citations: ExtractedCitation[],
    availableSources: CitationContext[]
  ): number {
    const factualClaims = claims.filter(c => c.needsCitation);
    if (factualClaims.length === 0) return 1.0; // No claims needing citation

    const citedClaims = factualClaims.filter(claim => 
      citations.some(citation => 
        citation.position.start >= claim.position.start - 100 &&
        citation.position.end <= claim.position.end + 100
      )
    );

    return citedClaims.length / factualClaims.length;
  }

  private validateContent(paragraphs: ParsedParagraph[], citations: ExtractedCitation[]): ContentValidation {
    const totalParagraphs = paragraphs.length;
    const groundingScores = paragraphs.map(p => p.groundingScore);
    const overallScore = groundingScores.reduce((sum, score) => sum + score, 0) / totalParagraphs;
    
    const citedParagraphs = paragraphs.filter(p => p.citationCount > 0).length;
    const citationCoverage = (citedParagraphs / totalParagraphs) * 100;
    
    // Determine hallucination risk
    const lowGroundingCount = groundingScores.filter(score => score < 0.5).length;
    const hallucinationRisk: 'low' | 'medium' | 'high' = 
      lowGroundingCount > totalParagraphs * 0.3 ? 'high' :
      lowGroundingCount > totalParagraphs * 0.15 ? 'medium' : 'low';

    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Identify issues
    if (overallScore < 0.6) {
      issues.push({
        type: 'weak_citation',
        severity: 'high',
        description: `Overall grounding quality is ${Math.round(overallScore * 100)}%`
      });
      suggestions.push('Strengthen evidence support throughout the document');
    }

    if (citationCoverage < 70) {
      issues.push({
        type: 'missing_source',
        severity: 'medium',
        description: `Only ${Math.round(citationCoverage)}% of paragraphs have citations`
      });
      suggestions.push('Add citations to more paragraphs to improve credibility');
    }

    return {
      overallScore,
      citationCoverage,
      hallucinationRisk,
      issues,
      suggestions
    };
  }

  private async validateSingleCitation(
    citation: ExtractedCitation,
    availableSources: CitationContext[]
  ): Promise<CitationValidation> {
    const issues: ValidationIssue[] = [];
    let isValid = true;
    let validationScore = 1.0;

    // Check if citation references available sources
    const sourceMatch = this.findSourceMatch(citation, availableSources);
    
    if (!sourceMatch) {
      issues.push({
        type: 'missing_source',
        severity: 'high',
        description: 'Citation references unavailable source'
      });
      isValid = false;
      validationScore = 0.3;
    } else if (sourceMatch.similarity < 0.6) {
      issues.push({
        type: 'weak_citation',
        severity: 'medium',
        description: 'Low similarity between claim and source'
      });
      validationScore = sourceMatch.similarity;
    }

    return {
      id: `validation-${citation.id}`,
      citationSourceId: citation.id,
      validationType: 'automatic',
      isValid,
      validationScore,
      issuesFound: issues,
      createdAt: new Date()
    };
  }

  private findSourceMatch(citation: ExtractedCitation, sources: CitationContext[]): CitationContext | null {
    // Simple text matching - in production, use semantic similarity
    const claimText = citation.claimText.toLowerCase();
    
    for (const source of sources) {
      const sourceText = source.content.toLowerCase();
      
      // Calculate rough similarity
      const similarity = this.calculateTextSimilarity(claimText, sourceText);
      if (similarity > 0.5) {
        return { ...source, similarity };
      }
    }
    
    return null;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private findMatchingSources(claim: ExtractedClaim, sources: CitationContext[]): CitationContext[] {
    return sources
      .map(source => ({
        ...source,
        similarity: this.calculateTextSimilarity(claim.text.toLowerCase(), source.content.toLowerCase())
      }))
      .filter(source => source.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity);
  }

  private calculateSuggestionConfidence(claim: ExtractedClaim, sources: CitationContext[]): number {
    if (sources.length === 0) return 0;
    
    const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
    return Math.min(claim.confidence * avgSimilarity * 1.2, 1.0);
  }

  private formatInlineCitation(citation: CitationSource, options: CitationExportOptions, number: number): string {
    switch (options.style) {
      case 'apa':
        return `(${citation.sectionTitle || 'Document'}, ${citation.pageNumber || 'n.p.'})`;
      case 'grant_standard':
        return `(${citation.sectionTitle || 'Source Document'}${citation.pageNumber ? `, p. ${citation.pageNumber}` : ''})`;
      default:
        return options.format === 'footnote' ? `[${number}]` : `[${citation.sectionTitle || 'Source'}]`;
    }
  }

  private formatBibliographyEntry(citation: CitationSource, options: CitationExportOptions): string {
    const docName = citation.sectionTitle || 'Source Document';
    const year = new Date().getFullYear(); // In production, extract from document metadata
    
    switch (options.style) {
      case 'apa':
        return `${docName}. (${year}). Organization Documents.`;
      case 'grant_standard':
        return `${docName}. Organizational Resource Documents.`;
      default:
        return `${docName} - Organizational Documentation`;
    }
  }

  private formatFootnote(citation: CitationSource, options: CitationExportOptions, number: number): string {
    return `${number}. ${citation.sectionTitle || 'Source Document'}${citation.pageNumber ? `, page ${citation.pageNumber}` : ''}.`;
  }
}