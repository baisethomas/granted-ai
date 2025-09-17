import crypto from 'crypto';

export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  chunkSize: number;
  sectionTitle?: string;
  pageNumber?: number;
  metadata: {
    isStart?: boolean;
    isEnd?: boolean;
    headings?: string[];
    context?: string;
    documentType?: string;
  };
}

export interface ChunkingOptions {
  maxTokens?: number; // Target chunk size in tokens (approximate)
  overlapTokens?: number; // Overlap between chunks
  preserveStructure?: boolean; // Try to preserve document structure
  respectBoundaries?: boolean; // Don't break sentences/paragraphs
  sectionAware?: boolean; // Detect and preserve section boundaries
}

export class DocumentChunker {
  private readonly defaultOptions: Required<ChunkingOptions> = {
    maxTokens: 800, // Optimal for grant writing context
    overlapTokens: 100, // 12.5% overlap
    preserveStructure: true,
    respectBoundaries: true,
    sectionAware: true,
  };

  /**
   * Estimate token count using a simple heuristic (4 chars ≈ 1 token)
   * This is faster than using tiktoken but less accurate
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract section headings and structure from text
   */
  private extractStructure(text: string): Array<{ heading: string; start: number; level: number }> {
    const headings: Array<{ heading: string; start: number; level: number }> = [];
    
    // Match various heading patterns
    const patterns = [
      /^#{1,6}\s+(.+)$/gm, // Markdown headings
      /^(.+)\n={3,}$/gm, // Underlined with =
      /^(.+)\n-{3,}$/gm, // Underlined with -
      /^\d+\.\s+(.+)$/gm, // Numbered sections
      /^[A-Z\s]{3,}:?\s*$/gm, // ALL CAPS headings
      /^(?:SECTION|PART|CHAPTER|APPENDIX)\s+[A-Z0-9]+:?\s*(.+)$/gim, // Formal sections
    ];

    patterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const heading = match[1]?.trim() || match[0].trim();
        if (heading.length > 2 && heading.length < 200) { // Reasonable heading length
          headings.push({
            heading,
            start: match.index,
            level: this.determineHeadingLevel(match[0], patternIndex),
          });
        }
      }
    });

    // Sort by position in document
    return headings.sort((a, b) => a.start - b.start);
  }

  private determineHeadingLevel(match: string, patternIndex: number): number {
    if (match.startsWith('#')) {
      return (match.match(/^#+/) || [''])[0].length;
    }
    return patternIndex + 1; // Simple level based on pattern type
  }

  /**
   * Find natural break points in text (sentences, paragraphs, sections)
   */
  private findBreakPoints(text: string, headings: Array<{ start: number; heading: string }>): number[] {
    const breakPoints = new Set<number>();
    
    // Add heading positions
    headings.forEach(h => breakPoints.add(h.start));
    
    // Add paragraph breaks (double newlines)
    const paragraphRegex = /\n\s*\n/g;
    let match;
    while ((match = paragraphRegex.exec(text)) !== null) {
      breakPoints.add(match.index + match[0].length);
    }
    
    // Add sentence endings (but be careful with abbreviations)
    const sentenceRegex = /[.!?]+\s+(?=[A-Z])/g;
    while ((match = sentenceRegex.exec(text)) !== null) {
      const position = match.index + match[0].length - 1;
      // Only add if not right after common abbreviations
      const beforeMatch = text.substring(Math.max(0, position - 10), position);
      if (!/\b(?:Dr|Mr|Mrs|Ms|Prof|Inc|Ltd|Corp|etc|vs|e\.g|i\.e)\s*$/i.test(beforeMatch)) {
        breakPoints.add(position);
      }
    }
    
    return Array.from(breakPoints).sort((a, b) => a - b);
  }

  /**
   * Get the context around a chunk (preceding and following content)
   */
  private getChunkContext(text: string, start: number, end: number, headings: Array<{ heading: string; start: number }>): string {
    // Find the current section heading
    const currentHeading = headings
      .filter(h => h.start <= start)
      .pop();
    
    // Get some context before and after
    const contextBefore = text.substring(Math.max(0, start - 200), start);
    const contextAfter = text.substring(end, Math.min(text.length, end + 200));
    
    const context = [];
    if (currentHeading) {
      context.push(`Section: ${currentHeading.heading}`);
    }
    if (contextBefore.trim()) {
      context.push(`Previous: ${contextBefore.trim().slice(-100)}`);
    }
    if (contextAfter.trim()) {
      context.push(`Following: ${contextAfter.trim().slice(0, 100)}`);
    }
    
    return context.join(' | ');
  }

  /**
   * Determine document type based on content patterns
   */
  private detectDocumentType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('mission statement') || lowerText.includes('organization profile')) {
      return 'organization-profile';
    }
    if (lowerText.includes('budget') || lowerText.includes('financial')) {
      return 'budget';
    }
    if (lowerText.includes('program description') || lowerText.includes('logic model')) {
      return 'program';
    }
    if (lowerText.includes('needs assessment') || lowerText.includes('problem statement')) {
      return 'assessment';
    }
    if (lowerText.includes('request for proposal') || lowerText.includes('rfp')) {
      return 'rfp';
    }
    if (lowerText.includes('evaluation') || lowerText.includes('metrics')) {
      return 'evaluation';
    }
    
    return 'general';
  }

  /**
   * Create overlapping content between chunks for better context
   */
  private createOverlap(text: string, chunkEnd: number, overlapTokens: number): string {
    const overlapChars = overlapTokens * 4; // Approximate conversion
    const overlapStart = Math.max(0, chunkEnd - overlapChars);
    
    // Try to start overlap at a sentence boundary
    const overlapText = text.substring(overlapStart, chunkEnd);
    const sentenceStart = overlapText.search(/[.!?]\s+/);
    
    if (sentenceStart > 0 && sentenceStart < overlapChars * 0.8) {
      return overlapText.substring(sentenceStart + 2);
    }
    
    return overlapText;
  }

  /**
   * Chunk a document into semantic chunks optimized for RAG retrieval
   */
  public chunkDocument(
    text: string, 
    filename: string, 
    options: ChunkingOptions = {}
  ): DocumentChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: DocumentChunk[] = [];
    
    if (!text || text.trim().length === 0) {
      return chunks;
    }
    
    // Clean the text
    const cleanText = text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Reduce excessive newlines
      .trim();
    
    const documentType = this.detectDocumentType(cleanText);
    const headings = opts.sectionAware ? this.extractStructure(cleanText) : [];
    const breakPoints = opts.respectBoundaries ? this.findBreakPoints(cleanText, headings) : [];
    
    let currentPosition = 0;
    let chunkIndex = 0;
    let lastOverlap = '';
    
    while (currentPosition < cleanText.length) {
      let chunkStart = currentPosition;
      let targetEnd = currentPosition + (opts.maxTokens * 4); // Approximate char count
      
      // Include overlap from previous chunk
      let chunkContent = lastOverlap;
      
      if (chunkContent && currentPosition > 0) {
        chunkStart = currentPosition - lastOverlap.length;
      }
      
      // Find the best end point for this chunk
      let chunkEnd = Math.min(targetEnd, cleanText.length);
      
      if (opts.respectBoundaries && chunkEnd < cleanText.length) {
        // Find the nearest break point before our target end
        const nearestBreak = breakPoints
          .filter(bp => bp > chunkStart && bp <= targetEnd + (opts.maxTokens * 2)) // Allow some flexibility
          .pop();
        
        if (nearestBreak) {
          chunkEnd = nearestBreak;
        } else {
          // Fall back to word boundary
          while (chunkEnd > chunkStart && !/\s/.test(cleanText[chunkEnd])) {
            chunkEnd--;
          }
        }
      }
      
      // Extract the chunk content (including overlap)
      chunkContent += cleanText.substring(Math.max(currentPosition, chunkStart), chunkEnd);
      
      if (chunkContent.trim().length === 0) {
        break;
      }
      
      // Find current section title
      const currentHeading = headings
        .filter(h => h.start <= chunkStart)
        .pop();
      
      // Estimate page number (rough approximation)
      const pageNumber = Math.floor(chunkStart / 2500) + 1; // ~2500 chars per page
      
      const chunk: DocumentChunk = {
        content: chunkContent.trim(),
        chunkIndex,
        chunkSize: this.estimateTokens(chunkContent),
        sectionTitle: currentHeading?.heading,
        pageNumber,
        metadata: {
          isStart: chunkIndex === 0,
          isEnd: chunkEnd >= cleanText.length,
          headings: headings
            .filter(h => h.start >= chunkStart && h.start < chunkEnd)
            .map(h => h.heading),
          context: this.getChunkContext(cleanText, chunkStart, chunkEnd, headings),
          documentType,
        },
      };
      
      chunks.push(chunk);
      
      // Prepare overlap for next chunk
      if (chunkEnd < cleanText.length && opts.overlapTokens > 0) {
        lastOverlap = this.createOverlap(cleanText, chunkEnd, opts.overlapTokens);
      } else {
        lastOverlap = '';
      }
      
      currentPosition = chunkEnd;
      chunkIndex++;
    }
    
    return chunks;
  }

  /**
   * Generate a hash for chunk content (for caching embeddings)
   */
  public generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Optimize chunks for specific grant question types
   */
  public optimizeForQuestionType(chunks: DocumentChunk[], questionType: string): DocumentChunk[] {
    // Prioritize chunks that are more relevant to the question type
    const relevanceKeywords: Record<string, string[]> = {
      mission: ['mission', 'vision', 'values', 'purpose', 'goals'],
      needs: ['problem', 'need', 'challenge', 'gap', 'issue', 'data'],
      goals: ['goal', 'objective', 'outcome', 'impact', 'result'],
      methods: ['approach', 'method', 'strategy', 'implementation', 'process'],
      evaluation: ['evaluation', 'measure', 'metric', 'assess', 'track', 'monitor'],
      budget: ['budget', 'cost', 'expense', 'funding', 'financial'],
      experience: ['experience', 'history', 'past', 'previous', 'track record'],
      sustainability: ['sustain', 'continue', 'future', 'long-term', 'maintenance'],
    };
    
    const keywords = relevanceKeywords[questionType.toLowerCase()] || [];
    
    if (keywords.length === 0) {
      return chunks;
    }
    
    // Score chunks based on keyword relevance
    const scoredChunks = chunks.map(chunk => {
      const content = chunk.content.toLowerCase();
      const score = keywords.reduce((acc, keyword) => {
        const matches = (content.match(new RegExp(keyword, 'gi')) || []).length;
        return acc + matches;
      }, 0);
      
      return { ...chunk, relevanceScore: score };
    });
    
    // Sort by relevance score (descending) while maintaining document order
    return scoredChunks.sort((a, b) => {
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 2) {
        return b.relevanceScore - a.relevanceScore;
      }
      return a.chunkIndex - b.chunkIndex;
    });
  }
}