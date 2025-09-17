import type { 
  ClarificationSession, 
  ClarificationQuestion,
  ClarificationAnswer,
  AssumptionLabel
} from "./types";

export interface QualityMetrics {
  // Overall session metrics
  sessionCompletionRate: number; // 0-1
  questionResponseRate: number; // 0-1
  avgConfidenceScore: number; // 0-1
  timeToComplete: number; // minutes
  
  // Content quality metrics
  responseSpecificity: number; // 0-1 score based on specific details
  evidenceProvided: number; // 0-1 score for data/evidence inclusion
  quantificationLevel: number; // 0-1 score for numerical details
  
  // Impact metrics
  assumptionReduction: number; // % reduction in assumptions after clarification
  contextEnhancement: number; // % increase in context length/quality
  qualityImprovementScore: number; // 0-100 overall quality improvement
  
  // Category-specific metrics
  categoryCompleteness: Record<string, number>; // completion rate by category
  categoryQuality: Record<string, number>; // quality score by category
  
  // Engagement metrics  
  followUpGenerated: number; // number of follow-up questions generated
  iterationsCompleted: number; // number of clarification rounds
}

export interface ComparisonMetrics {
  beforeClarification: {
    textLength: number;
    assumptions: number;
    specificityScore: number;
    evidenceScore: number;
  };
  afterClarification: {
    textLength: number;
    assumptions: number;
    specificityScore: number;
    evidenceScore: number;
  };
  improvement: {
    textLengthIncrease: number;
    assumptionReduction: number;
    specificityImprovement: number;
    evidenceImprovement: number;
  };
}

/**
 * Analyzes and calculates quality metrics for clarification sessions
 */
export class QualityMetricsAnalyzer {
  
  /**
   * Calculate comprehensive quality metrics for a clarification session
   */
  calculateSessionMetrics(
    session: ClarificationSession,
    startTime?: Date,
    endTime?: Date
  ): QualityMetrics {
    const totalQuestions = session.questions.length;
    const totalAnswers = session.answers.length;
    
    // Basic completion metrics
    const sessionCompletionRate = session.completionRate;
    const questionResponseRate = totalQuestions > 0 ? totalAnswers / totalQuestions : 0;
    
    // Confidence metrics
    const confidenceScores = session.answers.map(a => a.confidence || 0.5);
    const avgConfidenceScore = confidenceScores.length > 0 
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length 
      : 0;
    
    // Time metrics
    const timeToComplete = startTime && endTime 
      ? (endTime.getTime() - startTime.getTime()) / (1000 * 60) // minutes
      : 0;
    
    // Content quality analysis
    const responseSpecificity = this.calculateSpecificityScore(session.answers);
    const evidenceProvided = this.calculateEvidenceScore(session.answers);
    const quantificationLevel = this.calculateQuantificationScore(session.answers);
    
    // Category analysis
    const categoryCompleteness = this.calculateCategoryCompleteness(session);
    const categoryQuality = this.calculateCategoryQuality(session);
    
    // Follow-up metrics
    const followUpGenerated = session.answers.filter(a => a.followUpNeeded).length;
    const iterationsCompleted = 1; // TODO: Track multiple rounds
    
    // Overall quality improvement (placeholder - would be calculated with before/after comparison)
    const qualityImprovementScore = this.estimateQualityImprovement(session);
    
    return {
      sessionCompletionRate,
      questionResponseRate,
      avgConfidenceScore,
      timeToComplete,
      responseSpecificity,
      evidenceProvided,
      quantificationLevel,
      assumptionReduction: 0, // Will be calculated with before/after content
      contextEnhancement: 0, // Will be calculated with before/after content
      qualityImprovementScore,
      categoryCompleteness,
      categoryQuality,
      followUpGenerated,
      iterationsCompleted,
    };
  }

  /**
   * Calculate specificity score based on answer content
   */
  private calculateSpecificityScore(answers: ClarificationAnswer[]): number {
    if (answers.length === 0) return 0;
    
    const specificityIndicators = [
      /\b\d+%\b/g, // percentages
      /\$[\d,]+/g, // dollar amounts
      /\b\d+\s+(participants|people|months|years|days|hours)\b/gi, // quantities with units
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, // dates
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // date formats
      /\b\d+\s*-\s*\d+\b/g, // ranges
    ];
    
    let totalSpecificityPoints = 0;
    let totalAnswers = 0;
    
    for (const answer of answers) {
      let answerPoints = 0;
      for (const pattern of specificityIndicators) {
        const matches = answer.answer.match(pattern);
        answerPoints += matches ? matches.length : 0;
      }
      
      // Additional points for longer, detailed answers
      if (answer.answer.length > 200) answerPoints += 1;
      if (answer.answer.length > 500) answerPoints += 1;
      
      totalSpecificityPoints += Math.min(answerPoints, 5); // Cap at 5 points per answer
      totalAnswers++;
    }
    
    return totalAnswers > 0 ? Math.min(totalSpecificityPoints / (totalAnswers * 5), 1) : 0;
  }

  /**
   * Calculate evidence score based on answer content
   */
  private calculateEvidenceScore(answers: ClarificationAnswer[]): number {
    if (answers.length === 0) return 0;
    
    const evidenceIndicators = [
      /\b(data|study|research|survey|assessment|evaluation|report)\b/gi,
      /\b(census|statistics|metrics|baseline|benchmark)\b/gi,
      /\b(source|documentation|evidence|proof|validation)\b/gi,
      /\b(according to|based on|research shows|studies indicate)\b/gi,
      /\b(n=\d+|sample size|participants|respondents)\b/gi,
    ];
    
    let totalEvidencePoints = 0;
    let totalAnswers = 0;
    
    for (const answer of answers) {
      let answerPoints = 0;
      for (const pattern of evidenceIndicators) {
        const matches = answer.answer.match(pattern);
        answerPoints += matches ? matches.length : 0;
      }
      
      totalEvidencePoints += Math.min(answerPoints, 3); // Cap at 3 points per answer
      totalAnswers++;
    }
    
    return totalAnswers > 0 ? Math.min(totalEvidencePoints / (totalAnswers * 3), 1) : 0;
  }

  /**
   * Calculate quantification score based on numerical details
   */
  private calculateQuantificationScore(answers: ClarificationAnswer[]): number {
    if (answers.length === 0) return 0;
    
    const quantificationIndicators = [
      /\b\d+\b/g, // any numbers
      /\b\d+\.\d+\b/g, // decimals
      /\b\d+%\b/g, // percentages
      /\$\d+/g, // money amounts
      /\b(approximately|about|roughly)\s+\d+/gi, // estimated quantities
    ];
    
    let totalQuantificationPoints = 0;
    let totalAnswers = 0;
    
    for (const answer of answers) {
      let answerPoints = 0;
      for (const pattern of quantificationIndicators) {
        const matches = answer.answer.match(pattern);
        answerPoints += matches ? matches.length : 0;
      }
      
      totalQuantificationPoints += Math.min(answerPoints, 4); // Cap at 4 points per answer
      totalAnswers++;
    }
    
    return totalAnswers > 0 ? Math.min(totalQuantificationPoints / (totalAnswers * 4), 1) : 0;
  }

  /**
   * Calculate completion rate by category
   */
  private calculateCategoryCompleteness(session: ClarificationSession): Record<string, number> {
    const categoryQuestions: Record<string, number> = {};
    const categoryAnswers: Record<string, number> = {};
    
    // Count questions by category
    for (const question of session.questions) {
      categoryQuestions[question.category] = (categoryQuestions[question.category] || 0) + 1;
    }
    
    // Count answers by category
    for (const answer of session.answers) {
      const question = session.questions.find(q => q.id === answer.questionId);
      if (question) {
        categoryAnswers[question.category] = (categoryAnswers[question.category] || 0) + 1;
      }
    }
    
    // Calculate completion rates
    const categoryCompleteness: Record<string, number> = {};
    for (const category of Object.keys(categoryQuestions)) {
      const questions = categoryQuestions[category];
      const answers = categoryAnswers[category] || 0;
      categoryCompleteness[category] = questions > 0 ? answers / questions : 0;
    }
    
    return categoryCompleteness;
  }

  /**
   * Calculate quality score by category
   */
  private calculateCategoryQuality(session: ClarificationSession): Record<string, number> {
    const categoryQuality: Record<string, number> = {};
    
    // Group answers by category
    const answersByCategory: Record<string, ClarificationAnswer[]> = {};
    for (const answer of session.answers) {
      const question = session.questions.find(q => q.id === answer.questionId);
      if (question) {
        if (!answersByCategory[question.category]) {
          answersByCategory[question.category] = [];
        }
        answersByCategory[question.category].push(answer);
      }
    }
    
    // Calculate quality for each category
    for (const [category, answers] of Object.entries(answersByCategory)) {
      const avgConfidence = answers.reduce((sum, a) => sum + (a.confidence || 0.5), 0) / answers.length;
      const avgLength = answers.reduce((sum, a) => sum + a.answer.length, 0) / answers.length;
      const lengthScore = Math.min(avgLength / 200, 1); // Normalize length score
      
      categoryQuality[category] = (avgConfidence + lengthScore) / 2;
    }
    
    return categoryQuality;
  }

  /**
   * Estimate overall quality improvement from clarifications
   */
  private estimateQualityImprovement(session: ClarificationSession): number {
    // This is a simplified estimation - in practice would compare before/after content
    const completionBonus = session.completionRate * 30;
    const confidenceBonus = session.answers.reduce((sum, a) => sum + (a.confidence || 0.5), 0) / session.answers.length * 40;
    const categoryDiversityBonus = Object.keys(this.calculateCategoryCompleteness(session)).length * 5;
    const answerQualityBonus = session.answers.filter(a => a.answer.length > 100).length * 3;
    
    return Math.min(completionBonus + confidenceBonus + categoryDiversityBonus + answerQualityBonus, 100);
  }

  /**
   * Track assumption reduction through clarification process
   */
  calculateAssumptionReduction(
    beforeAssumptions: AssumptionLabel[],
    afterAssumptions: AssumptionLabel[],
    session: ClarificationSessionType
  ): {
    totalReduction: number;
    categoryReduction: Record<string, number>;
    confidenceImprovement: number;
    resolvedAssumptions: AssumptionLabel[];
    remainingCriticalAssumptions: AssumptionLabel[];
  } {
    // Calculate overall reduction
    const beforeCount = beforeAssumptions.length;
    const afterCount = afterAssumptions.length;
    const totalReduction = beforeCount > 0 ? ((beforeCount - afterCount) / beforeCount) * 100 : 0;

    // Calculate reduction by category
    const beforeByCategory: Record<string, number> = {};
    const afterByCategory: Record<string, number> = {};

    beforeAssumptions.forEach(a => {
      beforeByCategory[a.category] = (beforeByCategory[a.category] || 0) + 1;
    });

    afterAssumptions.forEach(a => {
      afterByCategory[a.category] = (afterByCategory[a.category] || 0) + 1;
    });

    const categoryReduction: Record<string, number> = {};
    for (const category of Object.keys(beforeByCategory)) {
      const before = beforeByCategory[category] || 0;
      const after = afterByCategory[category] || 0;
      categoryReduction[category] = before > 0 ? ((before - after) / before) * 100 : 0;
    }

    // Identify resolved assumptions (those that appear in before but not after)
    const afterTexts = new Set(afterAssumptions.map(a => a.text));
    const resolvedAssumptions = beforeAssumptions.filter(a => !afterTexts.has(a.text));

    // Calculate confidence improvement for assumptions addressed by clarifications
    const answeredCategories = new Set(session.answers.map(a => {
      const question = session.questions.find(q => q.id === a.questionId);
      return question?.category;
    }).filter(Boolean));

    const confidenceImprovement = this.calculateAssumptionConfidenceImprovement(
      beforeAssumptions,
      afterAssumptions,
      answeredCategories
    );

    // Identify remaining critical assumptions
    const remainingCriticalAssumptions = afterAssumptions.filter(a => 
      a.confidence > 0.8 && ['budget', 'outcomes', 'methodology'].includes(a.category)
    );

    return {
      totalReduction,
      categoryReduction,
      confidenceImprovement,
      resolvedAssumptions,
      remainingCriticalAssumptions
    };
  }

  /**
   * Calculate improvement in assumption confidence after clarifications
   */
  private calculateAssumptionConfidenceImprovement(
    beforeAssumptions: AssumptionLabel[],
    afterAssumptions: AssumptionLabel[],
    answeredCategories: Set<string>
  ): number {
    // For assumptions in categories that were addressed by clarifications,
    // calculate the average confidence reduction
    const relevantBeforeAssumptions = beforeAssumptions.filter(a => 
      answeredCategories.has(a.category)
    );
    const relevantAfterAssumptions = afterAssumptions.filter(a => 
      answeredCategories.has(a.category)
    );

    if (relevantBeforeAssumptions.length === 0) return 0;

    const avgBeforeConfidence = relevantBeforeAssumptions
      .reduce((sum, a) => sum + a.confidence, 0) / relevantBeforeAssumptions.length;

    const avgAfterConfidence = relevantAfterAssumptions.length > 0
      ? relevantAfterAssumptions.reduce((sum, a) => sum + a.confidence, 0) / relevantAfterAssumptions.length
      : 0;

    return ((avgBeforeConfidence - avgAfterConfidence) / avgBeforeConfidence) * 100;
  }

  /**
   * Compare content before and after clarifications
   */
  calculateComparisonMetrics(
    beforeText: string,
    afterText: string,
    beforeAssumptions: AssumptionLabel[],
    afterAssumptions: AssumptionLabel[]
  ): ComparisonMetrics {
    const beforeMetrics = {
      textLength: beforeText.length,
      assumptions: beforeAssumptions.length,
      specificityScore: this.calculateTextSpecificity(beforeText),
      evidenceScore: this.calculateTextEvidence(beforeText),
    };
    
    const afterMetrics = {
      textLength: afterText.length,
      assumptions: afterAssumptions.length,
      specificityScore: this.calculateTextSpecificity(afterText),
      evidenceScore: this.calculateTextEvidence(afterText),
    };
    
    const improvement = {
      textLengthIncrease: ((afterMetrics.textLength - beforeMetrics.textLength) / beforeMetrics.textLength) * 100,
      assumptionReduction: beforeMetrics.assumptions > 0 
        ? ((beforeMetrics.assumptions - afterMetrics.assumptions) / beforeMetrics.assumptions) * 100 
        : 0,
      specificityImprovement: (afterMetrics.specificityScore - beforeMetrics.specificityScore) * 100,
      evidenceImprovement: (afterMetrics.evidenceScore - beforeMetrics.evidenceScore) * 100,
    };
    
    return {
      beforeClarification: beforeMetrics,
      afterClarification: afterMetrics,
      improvement,
    };
  }

  /**
   * Calculate specificity score for text content
   */
  private calculateTextSpecificity(text: string): number {
    const specificityPatterns = [
      /\b\d+%\b/g,
      /\$[\d,]+/g,
      /\b\d+\s+(participants|people|months|years|days|hours)\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    ];
    
    let specificityScore = 0;
    for (const pattern of specificityPatterns) {
      const matches = text.match(pattern);
      specificityScore += matches ? matches.length : 0;
    }
    
    // Normalize by text length (per 1000 characters)
    return Math.min(specificityScore / (text.length / 1000), 1);
  }

  /**
   * Calculate evidence score for text content
   */
  private calculateTextEvidence(text: string): number {
    const evidencePatterns = [
      /\b(data|study|research|survey|assessment|evaluation|report)\b/gi,
      /\b(census|statistics|metrics|baseline|benchmark)\b/gi,
      /\b(source|documentation|evidence|proof|validation)\b/gi,
    ];
    
    let evidenceScore = 0;
    for (const pattern of evidencePatterns) {
      const matches = text.match(pattern);
      evidenceScore += matches ? matches.length : 0;
    }
    
    // Normalize by text length (per 1000 characters)
    return Math.min(evidenceScore / (text.length / 1000), 1);
  }

  /**
   * Generate quality improvement recommendations
   */
  generateRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.sessionCompletionRate < 0.8) {
      recommendations.push("Complete more clarification questions to significantly improve application quality");
    }
    
    if (metrics.avgConfidenceScore < 0.6) {
      recommendations.push("Provide more detailed answers with specific examples and data to increase confidence");
    }
    
    if (metrics.responseSpecificity < 0.5) {
      recommendations.push("Include more specific numbers, dates, and measurable details in your responses");
    }
    
    if (metrics.evidenceProvided < 0.4) {
      recommendations.push("Add supporting data, research citations, or documentation to strengthen your responses");
    }
    
    if (metrics.quantificationLevel < 0.5) {
      recommendations.push("Provide more quantitative details like budgets, timelines, and participant numbers");
    }
    
    // Category-specific recommendations
    for (const [category, completeness] of Object.entries(metrics.categoryCompleteness)) {
      if (completeness < 0.7) {
        recommendations.push(`Complete more questions in the ${category} category for stronger reviewer confidence`);
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push("Excellent clarification completion! Your responses should significantly strengthen your grant application.");
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const qualityMetricsAnalyzer = new QualityMetricsAnalyzer();