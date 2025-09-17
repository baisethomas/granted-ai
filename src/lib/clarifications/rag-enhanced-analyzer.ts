import { RAGPipeline } from "../rag/pipeline";
import { InformationGapAnalyzer } from "./gap-analyzer";
import { QuestionGenerator } from "./question-generator";
import { clarificationDb } from "./database";
import type { 
  InformationGap, 
  AnalysisContext, 
  ClarificationQuestion 
} from "./types";

/**
 * RAG-Enhanced Information Gap Analyzer
 * Uses document retrieval to provide more intelligent gap analysis
 */
export class RAGEnhancedGapAnalyzer extends InformationGapAnalyzer {
  private ragPipeline: RAGPipeline;

  constructor() {
    super();
    this.ragPipeline = new RAGPipeline();
  }

  /**
   * Enhanced gap analysis using RAG to understand what information is already available
   */
  async analyzeGaps(context: AnalysisContext): Promise<InformationGap[]> {
    const { grantQuestions, organizationId, existingContext } = context;

    try {
      // Step 1: For each grant question, check what relevant information is available via RAG
      const ragContexts = await this.generateRAGContextsForQuestions(
        grantQuestions,
        organizationId
      );

      // Step 2: Analyze gaps with enhanced context awareness
      const enhancedPrompt = this.buildRAGEnhancedAnalysisPrompt(
        grantQuestions,
        existingContext,
        ragContexts
      );

      // Step 3: Run analysis with RAG-informed context
      const analysisResult = await this.llmProvider.generate({
        instructions: enhancedPrompt,
        questions: grantQuestions,
        context: existingContext,
        maxTokens: 2500
      });

      return this.parseAnalysisResult(analysisResult);
    } catch (error) {
      console.error('Error in RAG-enhanced gap analysis:', error);
      // Fallback to standard analysis
      return super.analyzeGaps(context);
    }
  }

  /**
   * Generate RAG contexts for each grant question to understand available information
   */
  private async generateRAGContextsForQuestions(
    questions: string[],
    organizationId: string
  ): Promise<Array<{ question: string; context: string; hasRelevantContent: boolean }>> {
    const ragContexts: Array<{ question: string; context: string; hasRelevantContent: boolean }> = [];

    for (const question of questions.slice(0, 8)) { // Limit to avoid overwhelming
      try {
        const contextResult = await this.ragPipeline.generateContext(
          question,
          organizationId,
          {
            limit: 5,
            similarityThreshold: 0.5,
            maxTokens: 800,
          }
        );

        ragContexts.push({
          question,
          context: contextResult.context,
          hasRelevantContent: contextResult.relevantChunks.length > 0 && 
            !contextResult.context.includes('No relevant context found'),
        });
      } catch (error) {
        console.error(`Error generating RAG context for question: ${question.substring(0, 50)}...`, error);
        ragContexts.push({
          question,
          context: 'No context available due to retrieval error',
          hasRelevantContent: false,
        });
      }

      // Add delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return ragContexts;
  }

  /**
   * Build enhanced analysis prompt incorporating RAG context
   */
  private buildRAGEnhancedAnalysisPrompt(
    questions: string[],
    existingContext: string,
    ragContexts: Array<{ question: string; context: string; hasRelevantContent: boolean }>
  ): string {
    const contextAnalysis = ragContexts.map((rc, index) => {
      const hasInfo = rc.hasRelevantContent;
      const infoQuality = hasInfo ? 
        (rc.context.length > 1000 ? 'Rich' : rc.context.length > 400 ? 'Moderate' : 'Limited') :
        'None';

      return `QUESTION ${index + 1}: ${rc.question}
AVAILABLE INFO: ${infoQuality}
CONTEXT SUMMARY: ${hasInfo ? rc.context.substring(0, 200) + '...' : 'No relevant organizational documents found'}
GAP RISK: ${hasInfo ? 'Low-Medium' : 'High'}`;
    }).join('\n\n');

    return `You are a senior grant consultant with RAG-powered document analysis capabilities. You have analyzed the applicant's uploaded organizational documents for each grant question to identify what information IS available vs. what is MISSING.

GRANT QUESTIONS WITH DOCUMENT ANALYSIS:
${contextAnalysis}

ADDITIONAL CONTEXT PROVIDED:
${existingContext || 'No additional context provided'}

INTELLIGENT GAP ANALYSIS TASK:
Based on the document analysis above, identify ONLY the critical information gaps where:
1. The available documents provide insufficient or no relevant information
2. Missing information would significantly weaken the grant application  
3. The gap represents a genuine need for additional clarification from the applicant

DO NOT flag as gaps:
- Information that is clearly available in the uploaded documents
- Minor details when substantial information exists
- Generic requirements that can be inferred from available context

PRIORITIZE gaps for questions with:
- "High" gap risk (no relevant documents found)
- "Limited" information quality even with some relevant content
- Critical importance to grant success (budget, outcomes, methodology)

For each significant gap, analyze:

**BUDGET GAPS** (only if financial documents are insufficient):
- Missing cost calculations, sustainability plans, or financial justifications
- Impact: "Reviewers cannot assess financial feasibility without detailed budget breakdown"

**OUTCOME GAPS** (only if evaluation/impact docs are insufficient):  
- Missing baseline data, success metrics, or evaluation methodology
- Impact: "Cannot demonstrate accountability without measurable outcomes and evaluation plan"

**METHODOLOGY GAPS** (only if program/implementation docs are insufficient):
- Missing implementation details, evidence-based practices, or operational plans
- Impact: "Reviewers need specific implementation approach to assess feasibility"

**EVIDENCE GAPS** (only if needs assessment/data docs are insufficient):
- Missing community needs data, target population details, or supporting research
- Impact: "Insufficient evidence of community need weakens funding justification"

**TEAM GAPS** (only if staff/organizational capacity docs are insufficient):
- Missing staff qualifications, organizational capacity, or role definitions
- Impact: "Reviewers need confidence in organizational ability to deliver results"

**TIMELINE GAPS** (only if project planning docs are insufficient):
- Missing implementation timeline, milestones, or project management approach
- Impact: "Unclear timeline raises concerns about project management capacity"

**SUSTAINABILITY GAPS** (only if long-term planning docs are insufficient):
- Missing continuation plans, partnership strategies, or funding diversification
- Impact: "Funders want assurance of lasting impact beyond grant period"

**SPECIFICITY GAPS** (only if documents lack concrete details):
- Missing specific numbers, locations, eligibility criteria, or program details
- Impact: "Vague descriptions make proposal evaluation difficult"

FORMAT EXACTLY AS:
GAP: [category]|[severity]|[description focusing on what's missing despite available docs]|[specific missing data points]|[impact]

ONLY identify gaps that represent genuine missing information not available in uploaded documents. Maximum 8 critical gaps.`;
  }
}

/**
 * RAG-Enhanced Question Generator
 * Generates more targeted questions by understanding what information is already available
 */
export class RAGEnhancedQuestionGenerator extends QuestionGenerator {
  private ragPipeline: RAGPipeline;

  constructor(config?: any) {
    super(config);
    this.ragPipeline = new RAGPipeline();
  }

  /**
   * Generate questions with RAG context awareness
   */
  async generateQuestions(
    gaps: InformationGap[], 
    grantQuestions: string[],
    organizationId?: string
  ): Promise<ClarificationQuestion[]> {
    if (!organizationId) {
      return super.generateQuestions(gaps, grantQuestions);
    }

    try {
      // Enhance each gap with RAG context to generate more targeted questions
      const enhancedQuestions: ClarificationQuestion[] = [];

      for (const gap of gaps.slice(0, this.config.maxQuestions)) {
        const ragContext = await this.getRAGContextForGap(gap, grantQuestions, organizationId);
        const enhancedQuestion = await this.generateRAGEnhancedQuestion(gap, grantQuestions, ragContext);
        
        if (enhancedQuestion) {
          enhancedQuestions.push(enhancedQuestion);
        }
      }

      return this.optimizeQuestionSelection(enhancedQuestions);
    } catch (error) {
      console.error('Error generating RAG-enhanced questions:', error);
      return super.generateQuestions(gaps, grantQuestions);
    }
  }

  /**
   * Get RAG context specific to a gap category
   */
  private async getRAGContextForGap(
    gap: InformationGap,
    grantQuestions: string[],
    organizationId: string
  ): Promise<string> {
    // Create a search query based on the gap category and missing data points
    const searchQuery = this.buildGapSpecificQuery(gap);
    
    try {
      const contextResult = await this.ragPipeline.generateContext(
        searchQuery,
        organizationId,
        {
          limit: 3,
          similarityThreshold: 0.4,
          maxTokens: 600,
        }
      );

      return contextResult.context;
    } catch (error) {
      console.error(`Error getting RAG context for ${gap.category} gap:`, error);
      return 'No additional context available from documents.';
    }
  }

  /**
   * Build a search query optimized for finding information related to a specific gap
   */
  private buildGapSpecificQuery(gap: InformationGap): string {
    const categoryQueries = {
      budget: 'budget costs financial expenses funding sustainability revenue',
      timeline: 'timeline schedule milestones implementation phases deadlines',
      outcomes: 'outcomes results impact evaluation assessment success metrics',
      methodology: 'approach methods implementation process procedures practices',
      team: 'staff personnel team qualifications experience roles capacity',
      sustainability: 'sustainability continuation long-term funding future plans',
      evidence: 'data research assessment needs analysis community demographics',
      specificity: 'specific details numbers participants location criteria'
    };

    const baseQuery = categoryQueries[gap.category] || gap.category;
    const dataPoints = gap.missingDataPoints.join(' ');
    
    return `${baseQuery} ${dataPoints}`.trim();
  }

  /**
   * Generate a question enhanced with RAG context awareness
   */
  private async generateRAGEnhancedQuestion(
    gap: InformationGap,
    grantQuestions: string[],
    ragContext: string
  ): Promise<ClarificationQuestion | null> {
    const enhancedPrompt = `You are a senior grant consultant with access to the applicant's organizational documents. Generate a clarification question that accounts for what information IS already available.

INFORMATION GAP TO ADDRESS:
Category: ${gap.category}
Severity: ${gap.severity}
Description: ${gap.description}
Missing Data Points: ${gap.missingDataPoints.join(', ')}
Impact: ${gap.potentialImpact}

AVAILABLE DOCUMENT CONTEXT:
${ragContext}

RELATED GRANT QUESTIONS:
${grantQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

INTELLIGENT QUESTION GENERATION:
Your question should:
1. AVOID asking for information that's already available in the document context above
2. FOCUS on specific gaps not covered by existing organizational information
3. BUILD UPON what's already known rather than asking redundant questions
4. REQUEST the missing pieces that would complete the picture

If the document context already provides substantial information for this gap category, ask a TARGETED follow-up question for missing details. If there's minimal relevant context, ask a broader foundational question.

FORMAT RESPONSE EXACTLY AS:
QUESTION: [Targeted question that leverages existing context and fills genuine gaps]
TYPE: [number|date|text|list|boolean]
CONTEXT: [Why this specific information is needed given what's already available]
EXAMPLES: [Examples that complement the existing context]
RELATED: [Which grant questions this helps answer]

Generate a question that a grant reviewer would ask after reading the available documents: "The documents show X, but we still need to know Y."`;

    try {
      const result = await this.llmProvider.generate({
        instructions: enhancedPrompt,
        questions: grantQuestions,
        context: `RAG-enhanced clarification for ${gap.category}`,
        maxTokens: 500
      });

      return this.parseQuestionResult(result, gap);
    } catch (error) {
      console.error('Error generating RAG-enhanced question:', error);
      return this.getFallbackQuestion(gap);
    }
  }
}

/**
 * Factory function to create RAG-enhanced clarification components
 */
export function createRAGEnhancedClarificationSystem() {
  return {
    gapAnalyzer: new RAGEnhancedGapAnalyzer(),
    questionGenerator: new RAGEnhancedQuestionGenerator(),
  };
}