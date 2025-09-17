import { getLLMProvider } from "@/lib/llm";
import type { AssumptionLabel, ClarificationConfig } from "./types";

/**
 * Detects and labels assumptions in AI-generated grant content
 */
export class AssumptionDetector {
  private llmProvider = getLLMProvider();
  private config: ClarificationConfig;

  constructor(config?: Partial<ClarificationConfig>) {
    this.config = {
      maxQuestions: 5,
      minCriticalQuestions: 2,
      skipThreshold: 1,
      assumptionThreshold: 0.7,
      ...config
    };
  }

  async detectAssumptions(
    generatedText: string,
    questions: string[],
    availableContext: string
  ): Promise<AssumptionLabel[]> {
    
    const prompt = this.buildDetectionPrompt(generatedText, questions, availableContext);
    
    try {
      const result = await this.llmProvider.generate({
        instructions: prompt,
        questions,
        context: availableContext,
        maxTokens: 1200
      });

      const assumptions = this.parseAssumptionResult(result, generatedText);
      return assumptions.filter(a => a.confidence >= this.config.assumptionThreshold);
    } catch (error) {
      console.error('Error detecting assumptions:', error);
      return [];
    }
  }

  private buildDetectionPrompt(
    text: string, 
    questions: string[], 
    context: string
  ): string {
    return `You are an expert grant reviewer analyzing AI-generated content for assumptions and unsupported claims.

GENERATED TEXT TO ANALYZE:
"""
${text}
"""

AVAILABLE CONTEXT/EVIDENCE:
"""
${context || 'No supporting context provided'}
"""

ORIGINAL GRANT QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

TASK: Identify statements in the generated text that appear to be ASSUMPTIONS rather than facts supported by the available context.

Look for:
1. **BUDGET ASSUMPTIONS**: Cost estimates without clear basis, unsupported financial claims
2. **TIMELINE ASSUMPTIONS**: Arbitrary deadlines, unrealistic schedules without justification  
3. **OUTCOME ASSUMPTIONS**: Success metrics without baseline data or supporting evidence
4. **METHODOLOGY ASSUMPTIONS**: Claims about effectiveness without research backing
5. **TEAM ASSUMPTIONS**: Staff capabilities or availability not documented in context
6. **SUSTAINABILITY ASSUMPTIONS**: Future funding or support claims without evidence
7. **EVIDENCE ASSUMPTIONS**: Community needs or statistics not backed by data
8. **SPECIFICITY ASSUMPTIONS**: Precise numbers or details not found in source materials

For each assumption found, provide:
- The exact text making the assumption (quote it precisely)  
- Why it's an assumption vs. supported fact
- What specific question should be asked to resolve it
- Confidence level (0.0-1.0) that this is actually an assumption
- Category (budget|timeline|outcomes|methodology|team|sustainability|evidence|specificity)

FORMAT EACH ASSUMPTION AS:
ASSUMPTION: [exact quote from text]
REASON: [why this is an assumption]
QUESTION: [specific question to resolve]
CONFIDENCE: [0.0-1.0]
CATEGORY: [category]
---

Only flag statements that are clearly assumptions. Don't flag:
- General statements about program goals
- Standard grant language and formatting
- Statements clearly supported by the provided context
- Reasonable inferences from available data`;
  }

  private parseAssumptionResult(result: string, originalText: string): AssumptionLabel[] {
    const assumptions: AssumptionLabel[] = [];
    const sections = result.split('---');

    for (const section of sections) {
      const lines = section.trim().split('\n');
      let assumptionText = '';
      let reason = '';
      let question = '';
      let confidence = 0;
      let category = 'specificity';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('ASSUMPTION:')) {
          assumptionText = trimmedLine.substring(11).trim().replace(/^"|"$/g, '');
        } else if (trimmedLine.startsWith('REASON:')) {
          reason = trimmedLine.substring(7).trim();
        } else if (trimmedLine.startsWith('QUESTION:')) {
          question = trimmedLine.substring(9).trim();
        } else if (trimmedLine.startsWith('CONFIDENCE:')) {
          const confStr = trimmedLine.substring(11).trim();
          confidence = parseFloat(confStr) || 0;
        } else if (trimmedLine.startsWith('CATEGORY:')) {
          const cat = trimmedLine.substring(9).trim();
          if (this.isValidCategory(cat)) {
            category = cat;
          }
        }
      }

      if (assumptionText && question && confidence > 0) {
        const position = this.findTextPosition(originalText, assumptionText);
        if (position) {
          assumptions.push({
            id: this.generateAssumptionId(),
            text: assumptionText,
            category: category as AssumptionLabel['category'],
            confidence,
            suggestedQuestion: question,
            position
          });
        }
      }
    }

    return assumptions;
  }

  private isValidCategory(category: string): boolean {
    const validCategories = ['budget', 'timeline', 'outcomes', 'methodology', 'team', 'sustainability', 'evidence', 'specificity'];
    return validCategories.includes(category);
  }

  private findTextPosition(originalText: string, searchText: string): { start: number; end: number } | null {
    // Try exact match first
    let index = originalText.indexOf(searchText);
    if (index !== -1) {
      return { start: index, end: index + searchText.length };
    }

    // Try fuzzy matching for slight variations
    const words = searchText.split(' ');
    if (words.length > 3) {
      // Look for a sequence of the first and last few words
      const startPhrase = words.slice(0, 3).join(' ');
      const endPhrase = words.slice(-3).join(' ');
      
      const startIndex = originalText.indexOf(startPhrase);
      const endIndex = originalText.indexOf(endPhrase);
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return { 
          start: startIndex, 
          end: endIndex + endPhrase.length 
        };
      }
    }

    return null;
  }

  private generateAssumptionId(): string {
    return `assumption-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Labels assumptions in text for display to users
   */
  labelAssumptionsInText(text: string, assumptions: AssumptionLabel[]): string {
    let labeledText = text;
    
    // Sort by position (descending) to avoid offset issues
    const sortedAssumptions = assumptions
      .filter(a => a.position)
      .sort((a, b) => b.position.start - a.position.start);

    for (const assumption of sortedAssumptions) {
      const { start, end } = assumption.position;
      const originalText = labeledText.substring(start, end);
      const labeledSegment = `<span class="assumption-highlight" data-assumption-id="${assumption.id}" title="${assumption.suggestedQuestion}">${originalText}</span>`;
      
      labeledText = labeledText.substring(0, start) + labeledSegment + labeledText.substring(end);
    }

    return labeledText;
  }

  /**
   * Groups assumptions by category for better organization
   */
  groupAssumptionsByCategory(assumptions: AssumptionLabel[]): Record<string, AssumptionLabel[]> {
    const grouped: Record<string, AssumptionLabel[]> = {};
    
    for (const assumption of assumptions) {
      if (!grouped[assumption.category]) {
        grouped[assumption.category] = [];
      }
      grouped[assumption.category].push(assumption);
    }

    return grouped;
  }

  /**
   * Generates clarification questions from high-confidence assumptions
   */
  generateQuestionsFromAssumptions(assumptions: AssumptionLabel[]): string[] {
    return assumptions
      .filter(a => a.confidence >= this.config.assumptionThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5) // Max 5 questions from assumptions
      .map(a => a.suggestedQuestion);
  }
}