import { InformationGapAnalyzer } from "./gap-analyzer";
import { QuestionGenerator } from "./question-generator";
import { AssumptionDetector } from "./assumption-detector";
import { RAGEnhancedGapAnalyzer, RAGEnhancedQuestionGenerator } from "./rag-enhanced-analyzer";
import type { 
  AnalysisContext, 
  ClarificationSession, 
  ClarificationQuestion,
  ClarificationAnswer,
  ClarificationConfig,
  AssumptionLabel
} from "./types";

/**
 * Main orchestrator for the Clarification Engine system
 * Coordinates gap analysis, question generation, and assumption detection
 */
export class ClarificationEngine {
  private gapAnalyzer: InformationGapAnalyzer;
  private questionGenerator: QuestionGenerator;
  private assumptionDetector: AssumptionDetector;
  private config: ClarificationConfig;
  private useRAG: boolean;

  constructor(config?: Partial<ClarificationConfig & { useRAG?: boolean }>) {
    this.config = {
      maxQuestions: 5,
      minCriticalQuestions: 2,
      skipThreshold: 1,
      assumptionThreshold: 0.7,
      ...config
    };

    this.useRAG = config?.useRAG ?? true;

    // Initialize components with RAG enhancement if enabled
    if (this.useRAG) {
      this.gapAnalyzer = new RAGEnhancedGapAnalyzer();
      this.questionGenerator = new RAGEnhancedQuestionGenerator(this.config);
    } else {
      this.gapAnalyzer = new InformationGapAnalyzer();
      this.questionGenerator = new QuestionGenerator(this.config);
    }
    
    this.assumptionDetector = new AssumptionDetector(this.config);
  }

  /**
   * Analyzes grant context and generates clarification questions
   */
  async generateClarifications(context: AnalysisContext): Promise<ClarificationQuestion[]> {
    try {
      // Step 1: Analyze information gaps
      console.log('Analyzing information gaps...');
      const gaps = await this.gapAnalyzer.analyzeGaps(context);
      
      if (gaps.length < this.config.skipThreshold) {
        console.log('Insufficient gaps found, skipping clarifications');
        return [];
      }

      // Step 2: Prioritize gaps
      const prioritizedGaps = this.gapAnalyzer.prioritizeGaps(gaps);
      console.log(`Found ${prioritizedGaps.length} information gaps`);

      // Step 3: Generate questions for top gaps
      const questions = this.useRAG && 'generateQuestions' in this.questionGenerator ?
        await (this.questionGenerator as any).generateQuestions(
          prioritizedGaps,
          context.grantQuestions,
          context.organizationId
        ) :
        await this.questionGenerator.generateQuestions(
          prioritizedGaps,
          context.grantQuestions
        );

      // Step 4: Optimize question selection
      const optimizedQuestions = this.questionGenerator.optimizeQuestionSelection(questions);
      console.log(`Generated ${optimizedQuestions.length} clarification questions`);

      return optimizedQuestions;
    } catch (error) {
      console.error('Error generating clarifications:', error);
      return [];
    }
  }

  /**
   * Generates follow-up questions based on existing answers
   */
  async generateFollowUpQuestions(
    session: ClarificationSession,
    context: AnalysisContext
  ): Promise<ClarificationQuestion[]> {
    try {
      console.log('Generating follow-up clarification questions...');
      
      // Find answers that need follow-up
      const answersNeedingFollowUp = session.answers.filter(a => a.followUpNeeded || a.confidence < 0.6);
      
      if (answersNeedingFollowUp.length === 0) {
        console.log('No answers need follow-up questions');
        return [];
      }

      const followUpQuestions: ClarificationQuestion[] = [];

      for (const answer of answersNeedingFollowUp) {
        const originalQuestion = session.questions.find(q => q.id === answer.questionId);
        if (!originalQuestion) continue;

        const followUp = await this.generateFollowUpForAnswer(originalQuestion, answer, context);
        if (followUp) {
          followUpQuestions.push(followUp);
        }
      }

      console.log(`Generated ${followUpQuestions.length} follow-up questions`);
      return followUpQuestions;
    } catch (error) {
      console.error('Error generating follow-up questions:', error);
      return [];
    }
  }

  /**
   * Generate a specific follow-up question for an answer that needs clarification
   */
  private async generateFollowUpForAnswer(
    originalQuestion: ClarificationQuestion,
    answer: ClarificationAnswer,
    context: AnalysisContext
  ): Promise<ClarificationQuestion | null> {
    const prompt = `You are a senior grant consultant reviewing a clarification answer that needs follow-up for a stronger application.

ORIGINAL QUESTION:
"${originalQuestion.question}"

CATEGORY: ${originalQuestion.category}
CONTEXT: ${originalQuestion.context}

APPLICANT'S ANSWER:
"${answer.answer}"

ANSWER QUALITY INDICATORS:
- Length: ${answer.answer.length} characters
- Confidence: ${Math.round(answer.confidence * 100)}%
- Completeness concerns: ${answer.confidence < 0.6 ? 'Yes - needs more detail' : 'Answer seems adequate but follow-up flagged'}

TASK: Generate ONE strategic follow-up question that addresses gaps in the answer and elicits the specific additional information needed for a competitive grant application.

FOLLOW-UP QUESTION STRATEGIES:
- If answer is too vague: Ask for specific numbers, examples, or methodologies
- If answer lacks evidence: Request data sources, documentation, or proof points  
- If answer is incomplete: Ask about missing components or implementation details
- If answer raises new questions: Probe deeper into concerning or unclear areas
- If answer needs quantification: Request metrics, timelines, or measurable details

FORMAT RESPONSE EXACTLY AS:
QUESTION: [Specific follow-up question that builds on the original answer]
TYPE: [number|date|text|list|boolean]
CONTEXT: [Why this additional information is critical for grant success]
EXAMPLES: [1-2 examples of strong additional details]
RELATED: [How this strengthens the original grant question responses]

Focus on gathering the missing piece that will make reviewers confident in this aspect of the proposal.`;

    try {
      const result = await this.questionGenerator['llmProvider'].generate({
        instructions: prompt,
        questions: context.grantQuestions,
        context: `Follow-up for ${originalQuestion.category} clarification`,
        maxTokens: 400
      });

      // Parse the follow-up question result
      const parsedQuestion = this.parseFollowUpResult(result, originalQuestion);
      return parsedQuestion;
    } catch (error) {
      console.error('Error generating follow-up question:', error);
      return null;
    }
  }

  /**
   * Parse the follow-up question generation result
   */
  private parseFollowUpResult(
    result: string,
    originalQuestion: ClarificationQuestion
  ): ClarificationQuestion | null {
    const lines = result.split('\n');
    let question = '';
    let answerType: ClarificationQuestion['expectedAnswerType'] = 'text';
    let context = '';
    let examples: string[] = [];
    let relatedQuestions: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('QUESTION:')) {
        question = trimmedLine.substring(9).trim();
      } else if (trimmedLine.startsWith('TYPE:')) {
        const type = trimmedLine.substring(5).trim();
        if (['number', 'date', 'text', 'list', 'boolean'].includes(type)) {
          answerType = type as ClarificationQuestion['expectedAnswerType'];
        }
      } else if (trimmedLine.startsWith('CONTEXT:')) {
        context = trimmedLine.substring(8).trim();
      } else if (trimmedLine.startsWith('EXAMPLES:')) {
        const exampleText = trimmedLine.substring(9).trim();
        examples = exampleText.split(',').map(e => e.trim()).filter(Boolean);
      } else if (trimmedLine.startsWith('RELATED:')) {
        const relatedText = trimmedLine.substring(8).trim();
        relatedQuestions = relatedText.split(',').map(r => r.trim()).filter(Boolean);
      }
    }

    if (!question || !context) {
      return null;
    }

    return {
      id: `followup-${originalQuestion.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      question: `Follow-up: ${question}`,
      category: originalQuestion.category,
      priority: originalQuestion.priority,
      expectedAnswerType: answerType,
      context: `${context} This builds on your previous answer to strengthen this section.`,
      examples: examples.length > 0 ? examples : undefined,
      relatedQuestions: relatedQuestions.length > 0 ? relatedQuestions : originalQuestion.relatedQuestions,
    };
  }

  /**
   * Determines if a session would benefit from follow-up questions
   */
  shouldGenerateFollowUps(session: ClarificationSession): boolean {
    // Check if any answers have low confidence or are flagged for follow-up
    const needsFollowUp = session.answers.some(a => 
      a.followUpNeeded || 
      a.confidence < 0.6 || 
      (a.answer.length < 100 && ['critical', 'high'].includes(session.questions.find(q => q.id === a.questionId)?.priority || 'low'))
    );

    // Only generate follow-ups if we haven't hit our question limit
    return needsFollowUp && session.questions.length < this.config.maxQuestions;
  }

  /**
   * Analyzes generated text for assumptions and suggests clarifications
   */
  async analyzeGeneratedContent(
    generatedText: string,
    context: AnalysisContext
  ): Promise<{
    assumptions: AssumptionLabel[];
    labeledText: string;
    suggestedQuestions: string[];
  }> {
    try {
      // Detect assumptions in generated text
      const assumptions = await this.assumptionDetector.detectAssumptions(
        generatedText,
        context.grantQuestions,
        context.existingContext
      );

      // Label assumptions in text for display
      const labeledText = this.assumptionDetector.labelAssumptionsInText(
        generatedText,
        assumptions
      );

      // Generate questions from high-confidence assumptions
      const suggestedQuestions = this.assumptionDetector.generateQuestionsFromAssumptions(
        assumptions
      );

      return {
        assumptions,
        labeledText,
        suggestedQuestions
      };
    } catch (error) {
      console.error('Error analyzing generated content:', error);
      return {
        assumptions: [],
        labeledText: generatedText,
        suggestedQuestions: []
      };
    }
  }

  /**
   * Creates a complete clarification session
   */
  async createClarificationSession(
    projectId: string,
    context: AnalysisContext
  ): Promise<ClarificationSession> {
    const questions = await this.generateClarifications(context);
    
    return {
      projectId,
      questions,
      answers: [],
      assumptions: [],
      status: questions.length > 0 ? 'active' : 'skipped',
      completionRate: 0
    };
  }

  /**
   * Updates a clarification session with new answers
   */
  updateSessionWithAnswers(
    session: ClarificationSession,
    answers: ClarificationAnswer[]
  ): ClarificationSession {
    const updatedAnswers = [...session.answers];
    
    for (const answer of answers) {
      const existingIndex = updatedAnswers.findIndex(a => a.questionId === answer.questionId);
      if (existingIndex >= 0) {
        updatedAnswers[existingIndex] = answer;
      } else {
        updatedAnswers.push(answer);
      }
    }

    const completionRate = updatedAnswers.length / session.questions.length;
    const status = completionRate >= 0.8 ? 'completed' : 'active';

    return {
      ...session,
      answers: updatedAnswers,
      completionRate,
      status
    };
  }

  /**
   * Converts clarification answers into enhanced context for AI generation
   */
  buildEnhancedContext(
    originalContext: string,
    session: ClarificationSession
  ): string {
    if (session.answers.length === 0) {
      return originalContext;
    }

    const clarificationContext = session.answers
      .map(answer => {
        const question = session.questions.find(q => q.id === answer.questionId);
        if (!question) return '';
        
        return `**${question.category.toUpperCase()} CLARIFICATION:**
Q: ${question.question}
A: ${answer.answer}
Context: ${question.context}`;
      })
      .filter(Boolean)
      .join('\n\n');

    return `${originalContext}\n\n--- CLARIFYING INFORMATION ---\n\n${clarificationContext}`;
  }

  /**
   * Evaluates the quality improvement from clarifications
   */
  evaluateQualityImpact(
    beforeText: string,
    afterText: string,
    session: ClarificationSession
  ): number {
    // Simple heuristic scoring based on:
    // 1. Text length increase (more detail)
    // 2. Reduction in vague language
    // 3. Addition of specific numbers/dates
    // 4. Answers to critical questions

    let score = 0;

    // Length increase (up to 20 points)
    const lengthIncrease = (afterText.length - beforeText.length) / beforeText.length;
    score += Math.min(lengthIncrease * 100, 20);

    // Specificity indicators (up to 30 points)
    const specificityWords = /\b(\d+%|\$[\d,]+|\d+\s+(participants|people|months|years|days))\b/g;
    const beforeMatches = (beforeText.match(specificityWords) || []).length;
    const afterMatches = (afterText.match(specificityWords) || []).length;
    score += Math.min((afterMatches - beforeMatches) * 3, 30);

    // Critical questions answered (up to 50 points)
    const criticalQuestions = session.questions.filter(q => q.priority === 'critical' || q.priority === 'high');
    const criticalAnswers = session.answers.filter(a => {
      const question = session.questions.find(q => q.id === a.questionId);
      return question && (question.priority === 'critical' || question.priority === 'high');
    });
    score += (criticalAnswers.length / Math.max(criticalQuestions.length, 1)) * 50;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Gets analytics data for clarification effectiveness
   */
  getAnalytics(sessions: ClarificationSession[]): {
    totalSessions: number;
    completionRate: number;
    avgQuestionsPerSession: number;
    topCategories: Array<{ category: string; count: number }>;
    qualityImpact: number;
  } {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const totalQuestions = sessions.reduce((sum, s) => sum + s.questions.length, 0);
    const totalAnswers = sessions.reduce((sum, s) => sum + s.answers.length, 0);

    // Count questions by category
    const categoryCount: Record<string, number> = {};
    sessions.forEach(session => {
      session.questions.forEach(question => {
        categoryCount[question.category] = (categoryCount[question.category] || 0) + 1;
      });
    });

    const topCategories = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgQualityScore = sessions
      .filter(s => s.qualityScore !== undefined)
      .reduce((sum, s) => sum + (s.qualityScore || 0), 0) / Math.max(completedSessions.length, 1);

    return {
      totalSessions: sessions.length,
      completionRate: totalAnswers / Math.max(totalQuestions, 1),
      avgQuestionsPerSession: totalQuestions / Math.max(sessions.length, 1),
      topCategories,
      qualityImpact: avgQualityScore
    };
  }
}