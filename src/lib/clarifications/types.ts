// Types for the Clarification Engine system

export type InformationGap = {
  category: 'budget' | 'timeline' | 'outcomes' | 'methodology' | 'team' | 'sustainability' | 'evidence' | 'specificity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  relatedQuestion?: string;
  missingDataPoints: string[];
  potentialImpact: string;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  category: InformationGap['category'];
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedAnswerType: 'number' | 'date' | 'text' | 'list' | 'boolean';
  context: string; // Why this question is important
  examples?: string[]; // Example answers to guide users
  relatedQuestions?: string[]; // Grant questions this helps answer
};

export type ClarificationAnswer = {
  questionId: string;
  answer: string;
  confidence: number; // 0-1 scale of answer completeness
  followUpNeeded: boolean;
  metadata?: Record<string, any>;
};

export type AssumptionLabel = {
  id: string;
  text: string; // The assumption made in the text
  category: InformationGap['category'];
  confidence: number; // 0-1 how confident we are this is an assumption
  suggestedQuestion: string;
  position: { start: number; end: number }; // Position in the generated text
};

export type ClarificationSession = {
  projectId: string;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  assumptions: AssumptionLabel[];
  status: 'active' | 'completed' | 'skipped';
  completionRate: number; // 0-1
  qualityScore?: number; // Impact on final output quality
};

export type AnalysisContext = {
  grantQuestions: string[];
  organizationId: string;
  availableDocuments: string[];
  existingContext: string;
  tone: string;
};

export type ClarificationConfig = {
  maxQuestions: number;
  minCriticalQuestions: number;
  skipThreshold: number; // Skip if less than this many gaps found
  assumptionThreshold: number; // Confidence threshold for labeling assumptions
};