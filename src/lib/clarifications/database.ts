import { createClient } from "@/lib/supabase/server";
import { 
  clarificationSessions,
  clarificationQuestions, 
  clarificationAnswers,
  assumptionLabels,
  documents
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { 
  ClarificationSession as ClarificationSessionType, 
  ClarificationQuestion as ClarificationQuestionType,
  ClarificationAnswer as ClarificationAnswerType,
  AssumptionLabel,
  AnalysisContext
} from "./types";

// Initialize database connection
const connectionString = process.env.DATABASE_URL || "";
const client = postgres(connectionString);
const db = drizzle(client);

export class ClarificationDatabase {
  
  /**
   * Get available documents for an organization to enhance analysis context
   */
  async getOrganizationDocuments(organizationId: string): Promise<string[]> {
    try {
      const docs = await db
        .select({
          filename: documents.originalName,
          summary: documents.summary
        })
        .from(documents)
        .where(
          and(
            eq(documents.organizationId, organizationId),
            eq(documents.processed, true)
          )
        );

      return docs.map(doc => `${doc.filename}: ${doc.summary || 'No summary available'}`);
    } catch (error) {
      console.error('Error fetching organization documents:', error);
      return [];
    }
  }

  /**
   * Create a new clarification session in the database
   */
  async createSession(
    projectId: string,
    organizationId: string, 
    questions: ClarificationQuestionType[],
    grantQuestions: string[],
    existingContext?: string
  ): Promise<ClarificationSessionType | null> {
    try {
      const [session] = await db
        .insert(clarificationSessions)
        .values({
          projectId,
          organizationId,
          status: questions.length > 0 ? 'active' : 'skipped',
          completionRate: 0,
          grantQuestions: JSON.stringify(grantQuestions),
          existingContext: existingContext || '',
        })
        .returning();

      // Insert clarification questions
      if (questions.length > 0) {
        await db
          .insert(clarificationQuestions)
          .values(
            questions.map(q => ({
              sessionId: session.id,
              question: q.question,
              category: q.category,
              priority: q.priority,
              expectedAnswerType: q.expectedAnswerType,
              context: q.context,
              examples: q.examples ? JSON.stringify(q.examples) : null,
              relatedQuestions: q.relatedQuestions ? JSON.stringify(q.relatedQuestions) : null,
            }))
          );
      }

      // Fetch the complete session with questions
      return this.getSessionById(session.id);
    } catch (error) {
      console.error('Error creating clarification session:', error);
      return null;
    }
  }

  /**
   * Get a clarification session by ID with all questions and answers
   */
  async getSessionById(sessionId: string): Promise<ClarificationSessionType | null> {
    try {
      const [sessionData] = await db
        .select()
        .from(clarificationSessions)
        .where(eq(clarificationSessions.id, sessionId));

      if (!sessionData) return null;

      const questions = await db
        .select()
        .from(clarificationQuestions)
        .where(eq(clarificationQuestions.sessionId, sessionId));

      const answers = await db
        .select()
        .from(clarificationAnswers)
        .where(eq(clarificationAnswers.sessionId, sessionId));

      // Convert database format to application format
      const session: ClarificationSessionType = {
        projectId: sessionData.projectId,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          category: q.category as any,
          priority: q.priority as any,
          expectedAnswerType: q.expectedAnswerType as any,
          context: q.context,
          examples: q.examples ? JSON.parse(q.examples as string) : undefined,
          relatedQuestions: q.relatedQuestions ? JSON.parse(q.relatedQuestions as string) : undefined,
        })),
        answers: answers.map(a => ({
          questionId: a.questionId,
          answer: a.answer,
          confidence: (a.confidence || 50) / 100, // Convert back to 0-1 scale
          followUpNeeded: a.followUpNeeded || false,
          metadata: a.metadata ? JSON.parse(a.metadata as string) : undefined,
        })),
        assumptions: [], // Will be populated separately if needed
        status: sessionData.status as any,
        completionRate: (sessionData.completionRate || 0) / 100, // Convert back to 0-1 scale
        qualityScore: sessionData.qualityScore || undefined,
      };

      return session;
    } catch (error) {
      console.error('Error fetching clarification session:', error);
      return null;
    }
  }

  /**
   * Update a clarification session with new answers
   */
  async updateSessionWithAnswers(
    sessionId: string,
    answers: ClarificationAnswerType[]
  ): Promise<ClarificationSessionType | null> {
    try {
      // Insert or update answers
      for (const answer of answers) {
        await db
          .insert(clarificationAnswers)
          .values({
            questionId: answer.questionId,
            sessionId: sessionId,
            answer: answer.answer,
            confidence: Math.round((answer.confidence || 0.5) * 100), // Convert to 0-100
            followUpNeeded: answer.followUpNeeded || false,
            metadata: answer.metadata ? JSON.stringify(answer.metadata) : '{}',
          })
          .onConflictDoUpdate({
            target: [clarificationAnswers.questionId, clarificationAnswers.sessionId],
            set: {
              answer: answer.answer,
              confidence: Math.round((answer.confidence || 0.5) * 100),
              followUpNeeded: answer.followUpNeeded || false,
              metadata: answer.metadata ? JSON.stringify(answer.metadata) : '{}',
              updatedAt: new Date(),
            },
          });
      }

      // Get total questions for completion rate calculation
      const questionCount = await db
        .select({ count: clarificationQuestions.id })
        .from(clarificationQuestions)
        .where(eq(clarificationQuestions.sessionId, sessionId));

      const totalQuestions = questionCount.length;
      const totalAnswers = answers.length;
      const completionRate = totalQuestions > 0 ? Math.round((totalAnswers / totalQuestions) * 100) : 0;
      const status = completionRate >= 80 ? 'completed' : 'active';

      // Update session completion rate and status
      await db
        .update(clarificationSessions)
        .set({
          completionRate,
          status,
          updatedAt: new Date(),
        })
        .where(eq(clarificationSessions.id, sessionId));

      return this.getSessionById(sessionId);
    } catch (error) {
      console.error('Error updating clarification session:', error);
      return null;
    }
  }

  /**
   * Store detected assumptions in the database
   */
  async storeAssumptions(
    projectId: string,
    draftId: string | null,
    assumptions: AssumptionLabel[]
  ): Promise<void> {
    try {
      if (assumptions.length === 0) return;

      await db
        .insert(assumptionLabels)
        .values(
          assumptions.map(assumption => ({
            projectId,
            draftId: draftId || null,
            text: assumption.text,
            category: assumption.category,
            confidence: Math.round(assumption.confidence * 100), // Convert to 0-100
            suggestedQuestion: assumption.suggestedQuestion,
            position: JSON.stringify(assumption.position),
          }))
        );
    } catch (error) {
      console.error('Error storing assumptions:', error);
    }
  }

  /**
   * Get assumptions for a project or draft
   */
  async getAssumptions(projectId: string, draftId?: string): Promise<AssumptionLabel[]> {
    try {
      const whereClause = draftId 
        ? and(eq(assumptionLabels.projectId, projectId), eq(assumptionLabels.draftId, draftId))
        : eq(assumptionLabels.projectId, projectId);

      const assumptions = await db
        .select()
        .from(assumptionLabels)
        .where(whereClause)
        .orderBy(desc(assumptionLabels.confidence));

      return assumptions.map(a => ({
        id: a.id,
        text: a.text,
        category: a.category as any,
        confidence: (a.confidence || 70) / 100, // Convert back to 0-1 scale
        suggestedQuestion: a.suggestedQuestion,
        position: JSON.parse(a.position as string),
      }));
    } catch (error) {
      console.error('Error fetching assumptions:', error);
      return [];
    }
  }

  /**
   * Get analytics data for clarification effectiveness
   */
  async getAnalytics(organizationId: string): Promise<{
    totalSessions: number;
    completionRate: number;
    avgQuestionsPerSession: number;
    topCategories: Array<{ category: string; count: number }>;
    qualityImpact: number;
  }> {
    try {
      // Get basic session stats
      const sessions = await db
        .select({
          id: clarificationSessions.id,
          completionRate: clarificationSessions.completionRate,
          qualityScore: clarificationSessions.qualityScore,
        })
        .from(clarificationSessions)
        .where(eq(clarificationSessions.organizationId, organizationId));

      // Get question category stats
      const categoryStats = await db
        .select({
          category: clarificationQuestions.category,
          count: clarificationQuestions.id,
        })
        .from(clarificationQuestions)
        .innerJoin(clarificationSessions, eq(clarificationQuestions.sessionId, clarificationSessions.id))
        .where(eq(clarificationSessions.organizationId, organizationId))
        .groupBy(clarificationQuestions.category);

      // Calculate metrics
      const totalSessions = sessions.length;
      const avgCompletionRate = sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + (s.completionRate || 0), 0) / sessions.length / 100
        : 0;
      
      const avgQuestionsPerSession = categoryStats.length > 0 
        ? categoryStats.reduce((sum, c) => sum + (c.count || 0), 0) / totalSessions 
        : 0;

      const avgQualityScore = sessions
        .filter(s => s.qualityScore !== null)
        .reduce((sum, s) => sum + (s.qualityScore || 0), 0) / Math.max(sessions.length, 1);

      // Top categories
      const topCategories = categoryStats
        .map(stat => ({ 
          category: stat.category, 
          count: stat.count || 0 
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalSessions,
        completionRate: avgCompletionRate,
        avgQuestionsPerSession,
        topCategories,
        qualityImpact: avgQualityScore,
      };
    } catch (error) {
      console.error('Error fetching clarification analytics:', error);
      return {
        totalSessions: 0,
        completionRate: 0,
        avgQuestionsPerSession: 0,
        topCategories: [],
        qualityImpact: 0,
      };
    }
  }

  /**
   * Get recent clarification sessions for an organization
   */
  async getRecentSessions(organizationId: string, limit: number = 10): Promise<ClarificationSessionType[]> {
    try {
      const sessionData = await db
        .select()
        .from(clarificationSessions)
        .where(eq(clarificationSessions.organizationId, organizationId))
        .orderBy(desc(clarificationSessions.createdAt))
        .limit(limit);

      const sessions: ClarificationSessionType[] = [];
      
      for (const session of sessionData) {
        const fullSession = await this.getSessionById(session.id);
        if (fullSession) {
          sessions.push(fullSession);
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error fetching recent clarification sessions:', error);
      return [];
    }
  }

  /**
   * Enhanced analysis context with database-driven document retrieval
   */
  async buildEnhancedAnalysisContext(
    grantQuestions: string[],
    organizationId: string,
    existingContext?: string,
    tone?: string
  ): Promise<AnalysisContext> {
    const availableDocuments = await this.getOrganizationDocuments(organizationId);
    
    return {
      grantQuestions,
      organizationId,
      availableDocuments,
      existingContext: existingContext || '',
      tone: tone || 'professional',
    };
  }
}

// Export singleton instance
export const clarificationDb = new ClarificationDatabase();