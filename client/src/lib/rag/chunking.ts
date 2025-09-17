export interface DocumentChunk {
  id?: number;
  documentId: number;
  chunkIndex: number;
  content: string;
  chunkType: 'paragraph' | 'section' | 'table' | 'list' | 'heading';
  metadata: {
    startPosition?: number;
    endPosition?: number;
    pageNumber?: number;
    sectionTitle?: string;
    headingLevel?: number;
    hasNumbers?: boolean;
    hasFinancialData?: boolean;
    language?: string;
  };
  tokenCount: number;
}

export interface ChunkingOptions {
  maxTokens: number;
  overlapTokens: number;
  preserveStructure: boolean;
  splitOnSentences: boolean;
  questionTypes?: string[];
}

export class DocumentChunker {
  private static readonly DEFAULT_MAX_TOKENS = 800;
  private static readonly DEFAULT_OVERLAP_TOKENS = 100;
  private static readonly SENTENCE_ENDINGS = /[.!?]+\s+/g;
  private static readonly PARAGRAPH_BREAKS = /\n\s*\n/g;
  private static readonly SECTION_HEADERS = /^#+\s+(.+)$/gm;

  /**
   * Chunk a document into semantically meaningful pieces
   */
  static async chunkDocument(
    documentId: number,
    content: string,
    options: Partial<ChunkingOptions> = {}
  ): Promise<DocumentChunk[]> {
    const opts: ChunkingOptions = {
      maxTokens: this.DEFAULT_MAX_TOKENS,
      overlapTokens: this.DEFAULT_OVERLAP_TOKENS,
      preserveStructure: true,
      splitOnSentences: true,
      ...options
    };

    // Clean and normalize the content
    const cleanContent = this.cleanContent(content);
    
    // Detect document structure
    const structure = this.analyzeDocumentStructure(cleanContent);
    
    // Generate chunks based on structure
    const chunks: DocumentChunk[] = [];
    
    if (opts.preserveStructure && structure.hasStructure) {
      chunks.push(...this.structureBasedChunking(documentId, cleanContent, structure, opts));
    } else {
      chunks.push(...this.semanticChunking(documentId, cleanContent, opts));
    }

    // Post-process chunks for optimization
    return this.optimizeChunks(chunks, opts);
  }

  /**
   * Clean and normalize document content
   */
  private static cleanContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n')           // Normalize line endings
      .replace(/\t/g, ' ')             // Replace tabs with spaces
      .replace(/\s+/g, ' ')            // Normalize whitespace
      .replace(/\n\s+/g, '\n')         // Clean up line starts
      .trim();
  }

  /**
   * Analyze document structure to optimize chunking
   */
  private static analyzeDocumentStructure(content: string) {
    const structure = {
      hasStructure: false,
      hasSections: false,
      hasNumberedLists: false,
      hasTables: false,
      sections: [] as Array<{ title: string; start: number; level: number }>,
      tables: [] as Array<{ start: number; end: number }>,
      lists: [] as Array<{ start: number; end: number; type: string }>
    };

    // Detect section headers
    const sectionMatches = Array.from(content.matchAll(this.SECTION_HEADERS));
    if (sectionMatches.length > 0) {
      structure.hasSections = true;
      structure.hasStructure = true;
      structure.sections = sectionMatches.map(match => ({
        title: match[1],
        start: match.index!,
        level: match[0].indexOf('#') + 1
      }));
    }

    // Detect tables (simple heuristic)
    const tablePattern = /\|.+\|/g;
    const tableMatches = Array.from(content.matchAll(tablePattern));
    if (tableMatches.length > 2) {
      structure.hasTables = true;
      structure.hasStructure = true;
    }

    // Detect numbered lists
    const numberedListPattern = /^\d+\.\s+/gm;
    const listMatches = Array.from(content.matchAll(numberedListPattern));
    if (listMatches.length > 2) {
      structure.hasNumberedLists = true;
      structure.hasStructure = true;
    }

    return structure;
  }

  /**
   * Structure-based chunking that preserves document organization
   */
  private static structureBasedChunking(
    documentId: number,
    content: string,
    structure: any,
    options: ChunkingOptions
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    if (structure.hasSections) {
      // Chunk by sections
      for (let i = 0; i < structure.sections.length; i++) {
        const section = structure.sections[i];
        const nextSection = structure.sections[i + 1];
        const sectionEnd = nextSection ? nextSection.start : content.length;
        const sectionContent = content.slice(section.start, sectionEnd);
        
        // Further chunk large sections
        const sectionChunks = this.chunkTextBySentences(
          sectionContent, 
          options.maxTokens, 
          options.overlapTokens
        );
        
        sectionChunks.forEach((chunkContent, index) => {
          chunks.push({
            documentId,
            chunkIndex: chunks.length,
            content: chunkContent,
            chunkType: 'section',
            metadata: {
              sectionTitle: section.title,
              headingLevel: section.level,
              startPosition: section.start,
              endPosition: sectionEnd,
              hasNumbers: /\d+/.test(chunkContent),
              hasFinancialData: /\$|budget|cost|fund|grant/i.test(chunkContent)
            },
            tokenCount: this.estimateTokenCount(chunkContent)
          });
        });
      }
    } else {
      // Fall back to semantic chunking
      return this.semanticChunking(documentId, content, options);
    }

    return chunks;
  }

  /**
   * Semantic chunking that preserves meaning
   */
  private static semanticChunking(
    documentId: number,
    content: string,
    options: ChunkingOptions
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    
    // Split into paragraphs first
    const paragraphs = content.split(this.PARAGRAPH_BREAKS).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    
    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokenCount(paragraph);
      
      // If adding this paragraph would exceed max tokens, finalize current chunk
      if (currentTokens + paragraphTokens > options.maxTokens && currentChunk.length > 0) {
        chunks.push({
          documentId,
          chunkIndex: chunkIndex++,
          content: currentChunk.trim(),
          chunkType: 'paragraph',
          metadata: {
            hasNumbers: /\d+/.test(currentChunk),
            hasFinancialData: /\$|budget|cost|fund|grant/i.test(currentChunk)
          },
          tokenCount: currentTokens
        });
        
        // Start new chunk with overlap if specified
        if (options.overlapTokens > 0) {
          const sentences = currentChunk.split(this.SENTENCE_ENDINGS);
          const overlapSentences = sentences.slice(-2); // Last 2 sentences for overlap
          currentChunk = overlapSentences.join(' ') + ' ';
          currentTokens = this.estimateTokenCount(currentChunk);
        } else {
          currentChunk = '';
          currentTokens = 0;
        }
      }
      
      // Add paragraph to current chunk
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      currentTokens += paragraphTokens;
    }
    
    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        documentId,
        chunkIndex: chunkIndex,
        content: currentChunk.trim(),
        chunkType: 'paragraph',
        metadata: {
          hasNumbers: /\d+/.test(currentChunk),
          hasFinancialData: /\$|budget|cost|fund|grant/i.test(currentChunk)
        },
        tokenCount: currentTokens
      });
    }
    
    return chunks;
  }

  /**
   * Chunk text by sentences while respecting token limits
   */
  private static chunkTextBySentences(
    text: string, 
    maxTokens: number, 
    overlapTokens: number
  ): string[] {
    const sentences = text.split(this.SENTENCE_ENDINGS).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokenCount(sentence);
      
      if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Add overlap
        if (overlapTokens > 0) {
          const overlapSentences = currentChunk.split(this.SENTENCE_ENDINGS).slice(-1);
          currentChunk = overlapSentences.join(' ') + ' ';
          currentTokens = this.estimateTokenCount(currentChunk);
        } else {
          currentChunk = '';
          currentTokens = 0;
        }
      }
      
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens += sentenceTokens;
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * Optimize chunks for better retrieval performance
   */
  private static optimizeChunks(chunks: DocumentChunk[], options: ChunkingOptions): DocumentChunk[] {
    return chunks
      .filter(chunk => chunk.content.trim().length > 50) // Remove very short chunks
      .map((chunk, index) => ({
        ...chunk,
        chunkIndex: index, // Re-index after filtering
        metadata: {
          ...chunk.metadata,
          // Add question type relevance if specified
          ...(options.questionTypes ? {
            relevantQuestionTypes: this.identifyRelevantQuestionTypes(chunk.content, options.questionTypes)
          } : {})
        }
      }));
  }

  /**
   * Identify which question types this chunk is most relevant for
   */
  private static identifyRelevantQuestionTypes(content: string, questionTypes: string[]): string[] {
    const relevantTypes: string[] = [];
    const lowerContent = content.toLowerCase();
    
    const typeKeywords = {
      mission: ['mission', 'vision', 'purpose', 'goal', 'objective'],
      methodology: ['method', 'approach', 'process', 'procedure', 'technique', 'strategy'],
      budget: ['budget', 'cost', 'funding', 'financial', 'expense', 'revenue', '$'],
      timeline: ['timeline', 'schedule', 'deadline', 'duration', 'phase', 'month', 'year'],
      outcomes: ['outcome', 'result', 'impact', 'effect', 'achievement', 'success'],
      team: ['team', 'staff', 'personnel', 'researcher', 'investigator', 'coordinator'],
      sustainability: ['sustainability', 'continuation', 'long-term', 'future', 'ongoing'],
      evaluation: ['evaluation', 'assessment', 'measurement', 'metric', 'indicator']
    };
    
    for (const questionType of questionTypes) {
      const keywords = typeKeywords[questionType.toLowerCase()] || [];
      const hasKeywords = keywords.some(keyword => lowerContent.includes(keyword));
      if (hasKeywords) {
        relevantTypes.push(questionType);
      }
    }
    
    return relevantTypes;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  private static estimateTokenCount(text: string): number {
    // More accurate estimation based on OpenAI's tokenizer patterns
    // Average: ~4 characters per token, but adjust for different content types
    const baseCount = Math.ceil(text.length / 4);
    
    // Adjust for content with lots of numbers or technical terms
    const numberMatches = text.match(/\d+/g);
    const technicalTerms = text.match(/[A-Z]{2,}/g);
    
    let adjustment = 1.0;
    if (numberMatches && numberMatches.length > baseCount * 0.1) {
      adjustment += 0.2; // Numbers tend to be more tokens
    }
    if (technicalTerms && technicalTerms.length > baseCount * 0.1) {
      adjustment += 0.1; // Acronyms and technical terms
    }
    
    return Math.ceil(baseCount * adjustment);
  }
}

export default DocumentChunker;