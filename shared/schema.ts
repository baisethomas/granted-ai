import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, vector, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  organizationName: text("organization_name"),
  organizationType: text("organization_type"),
  ein: text("ein"),
  foundedYear: integer("founded_year"),
  primaryContact: text("primary_contact"),
  email: text("email"),
  mission: text("mission"),
  focusAreas: text("focus_areas").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Organizations for multi-tenancy
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  plan: text("plan").default("starter"), // starter, pro, team, enterprise
  billingCustomerId: text("billing_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User memberships in organizations
export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  role: text("role").notNull().default("writer"), // admin, writer, reviewer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  title: text("title").notNull(),
  funder: text("funder").notNull(),
  amount: text("amount"),
  deadline: timestamp("deadline"),
  status: text("status").notNull().default("draft"), // draft, submitted, awarded, declined
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  category: text("category"), // organization-info, past-successes, budgets, team-info
  summary: text("summary"),
  processed: boolean("processed").default(false),
  embeddingStatus: text("embedding_status").default("pending"), // pending, processing, complete, error
  chunkCount: integer("chunk_count").default(0),
  embeddingModel: text("embedding_model").default("text-embedding-3-small"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Document chunks for embeddings and retrieval
export const docChunks = pgTable("doc_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI text-embedding-3-small dimensions
  chunkSize: integer("chunk_size"),
  sectionTitle: text("section_title"),
  pageNumber: integer("page_number"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  chunkIndexPositive: check("doc_chunks_chunk_index_positive", sql`${table.chunkIndex} >= 0`),
  chunkSizePositive: check("doc_chunks_chunk_size_positive", sql`${table.chunkSize} > 0`),
}));

// Knowledge profile for organizational memory
export const knowledgeProfile = pgTable("knowledge_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  mission: text("mission"),
  beneficiaries: text("beneficiaries"),
  programs: jsonb("programs"), // JSON array of programs
  outcomes: jsonb("outcomes"), // JSON array of outcomes and metrics
  metrics: jsonb("metrics"), // JSON object of key metrics
  tone: text("tone").default("professional"),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Grant templates for common application types
export const grantTemplates = pgTable("grant_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  sections: jsonb("sections").notNull(), // JSON array of sections and questions
  isPublic: boolean("is_public").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const grantQuestions = pgTable("grant_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  question: text("question").notNull(),
  wordLimit: integer("word_limit"),
  priority: text("priority").default("medium"), // high, medium, low
  response: text("response"),
  responseStatus: text("response_status").default("pending"), // pending, generating, complete, failed, timeout, needs_context
  errorMessage: text("error_message"), // Error message for failed/timeout/needs_context states
  createdAt: timestamp("created_at").defaultNow(),
});

// Drafts table for versioned content
export const drafts = pgTable("drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  version: integer("version").notNull().default(1),
  content: text("content").notNull(), // Markdown content
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Draft citations for evidence mapping
export const draftCitations = pgTable("draft_citations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  draftId: varchar("draft_id").references(() => drafts.id).notNull(),
  section: text("section").notNull(),
  sourceDocumentId: varchar("source_document_id").references(() => documents.id).notNull(),
  chunkRefs: jsonb("chunk_refs"), // JSON array of chunk references
  createdAt: timestamp("created_at").defaultNow(),
});

// Clarification Sessions to track complete clarification workflows
export const clarificationSessions = pgTable("clarification_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  status: text("status").notNull().default("active"), // active, completed, skipped
  completionRate: integer("completion_rate").default(0), // 0-100
  qualityScore: integer("quality_score"), // 0-100, impact on final output
  grantQuestions: jsonb("grant_questions").notNull(), // Array of grant questions analyzed
  existingContext: text("existing_context"), // Original context before clarifications
  enhancedContext: text("enhanced_context"), // Context after clarifications
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual clarification questions within a session
export const clarificationQuestions = pgTable("clarification_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => clarificationSessions.id, { onDelete: "cascade" }).notNull(),
  question: text("question").notNull(),
  category: text("category").notNull(), // budget, timeline, outcomes, methodology, team, sustainability, evidence, specificity
  priority: text("priority").notNull(), // critical, high, medium, low
  expectedAnswerType: text("expected_answer_type").notNull(), // number, date, text, list, boolean
  context: text("context").notNull(), // Why this question is important
  examples: jsonb("examples"), // Array of example answers
  relatedQuestions: jsonb("related_questions"), // Array of related grant questions
  createdAt: timestamp("created_at").defaultNow(),
});

// Answers to clarification questions
export const clarificationAnswers = pgTable("clarification_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").references(() => clarificationQuestions.id, { onDelete: "cascade" }).notNull(),
  sessionId: varchar("session_id").references(() => clarificationSessions.id, { onDelete: "cascade" }).notNull(),
  answer: text("answer").notNull(),
  confidence: integer("confidence").default(50), // 0-100 confidence in answer completeness
  followUpNeeded: boolean("follow_up_needed").default(false),
  metadata: jsonb("metadata").default(sql`'{}'`), // Additional answer metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Assumptions detected in generated content
export const assumptionLabels = pgTable("assumption_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  draftId: varchar("draft_id").references(() => drafts.id),
  text: text("text").notNull(), // The assumption text
  category: text("category").notNull(), // budget, timeline, outcomes, etc.
  confidence: integer("confidence").notNull(), // 0-100 confidence this is an assumption
  suggestedQuestion: text("suggested_question").notNull(),
  position: jsonb("position").notNull(), // { start: number, end: number }
  resolved: boolean("resolved").default(false),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Legacy clarifications table (keeping for backwards compatibility)
export const clarifications = pgTable("clarifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Evaluations for rubric scoring
export const evaluations = pgTable("evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  rubric: jsonb("rubric").notNull(), // JSON object of rubric criteria
  score: jsonb("score").notNull(), // JSON object of scores per criterion
  feedback: text("feedback"),
  evaluatedBy: varchar("evaluated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Usage events for metering
export const usageEvents = pgTable("usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  type: text("type").notNull(), // upload, generation, export, etc.
  tokensIn: integer("tokens_in"),
  tokensOut: integer("tokens_out"),
  cost: integer("cost"), // Cost in cents
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// User invitations
export const invites = pgTable("invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("writer"),
  token: text("token").notNull().unique(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Subscriptions for billing
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  plan: text("plan").notNull(), // starter, pro, team, enterprise
  status: text("status").notNull().default("active"), // active, past_due, canceled
  renewalAt: timestamp("renewal_at"),
  seats: integer("seats").default(1),
  providerCustomerId: text("provider_customer_id"), // Stripe customer ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const responseVersions = pgTable("response_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").references(() => grantQuestions.id).notNull(),
  content: text("content").notNull(),
  tone: text("tone").notNull(),
  wordCount: integer("word_count").notNull(),
  version: integer("version").notNull(),
  isCurrent: boolean("is_current").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  defaultTone: text("default_tone").default("professional"),
  lengthPreference: text("length_preference").default("balanced"),
  emphasisAreas: text("emphasis_areas").array(),
  aiModel: text("ai_model").default("gpt-4o"),
  fallbackModel: text("fallback_model").default("gpt-3.5-turbo"),
  creativity: integer("creativity").default(30),
  contextUsage: integer("context_usage").default(80),
  emailNotifications: boolean("email_notifications").default(true),
  autoSave: boolean("auto_save").default(true),
  analytics: boolean("analytics").default(true),
  autoDetection: boolean("auto_detection").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  organizationName: true,
  organizationType: true,
  ein: true,
  foundedYear: true,
  primaryContact: true,
  email: true,
  mission: true,
  focusAreas: true,
});

export const insertOrganizationSchema = createInsertSchema(organizations).pick({
  name: true,
  plan: true,
  billingCustomerId: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).pick({
  userId: true,
  organizationId: true,
  role: true,
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  title: true,
  funder: true,
  amount: true,
  deadline: true,
  description: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  filename: true,
  originalName: true,
  fileType: true,
  fileSize: true,
  category: true,
  summary: true,
  processed: true,
  embeddingStatus: true,
  chunkCount: true,
  embeddingModel: true,
});

export const insertDocChunkSchema = createInsertSchema(docChunks).pick({
  documentId: true,
  chunkIndex: true,
  content: true,
  embedding: true,
  chunkSize: true,
  sectionTitle: true,
  pageNumber: true,
  metadata: true,
});

export const insertKnowledgeProfileSchema = createInsertSchema(knowledgeProfile).pick({
  organizationId: true,
  mission: true,
  beneficiaries: true,
  programs: true,
  outcomes: true,
  metrics: true,
  tone: true,
});

export const insertGrantTemplateSchema = createInsertSchema(grantTemplates).pick({
  name: true,
  description: true,
  sections: true,
  isPublic: true,
  createdBy: true,
});

export const insertGrantQuestionSchema = createInsertSchema(grantQuestions).pick({
  question: true,
  wordLimit: true,
  priority: true,
  errorMessage: true,
});

export const insertDraftSchema = createInsertSchema(drafts).pick({
  projectId: true,
  version: true,
  content: true,
  createdBy: true,
});

export const insertDraftCitationSchema = createInsertSchema(draftCitations).pick({
  draftId: true,
  section: true,
  sourceDocumentId: true,
  chunkRefs: true,
});

export const insertClarificationSessionSchema = createInsertSchema(clarificationSessions).pick({
  projectId: true,
  organizationId: true,
  status: true,
  completionRate: true,
  qualityScore: true,
  grantQuestions: true,
  existingContext: true,
  enhancedContext: true,
});

export const insertClarificationQuestionSchema = createInsertSchema(clarificationQuestions).pick({
  sessionId: true,
  question: true,
  category: true,
  priority: true,
  expectedAnswerType: true,
  context: true,
  examples: true,
  relatedQuestions: true,
});

export const insertClarificationAnswerSchema = createInsertSchema(clarificationAnswers).pick({
  questionId: true,
  sessionId: true,
  answer: true,
  confidence: true,
  followUpNeeded: true,
  metadata: true,
});

export const insertAssumptionLabelSchema = createInsertSchema(assumptionLabels).pick({
  projectId: true,
  draftId: true,
  text: true,
  category: true,
  confidence: true,
  suggestedQuestion: true,
  position: true,
  resolved: true,
  resolvedBy: true,
});

export const insertClarificationSchema = createInsertSchema(clarifications).pick({
  projectId: true,
  question: true,
  answer: true,
});

export const insertEvaluationSchema = createInsertSchema(evaluations).pick({
  projectId: true,
  rubric: true,
  score: true,
  feedback: true,
  evaluatedBy: true,
});

export const insertUsageEventSchema = createInsertSchema(usageEvents).pick({
  organizationId: true,
  type: true,
  tokensIn: true,
  tokensOut: true,
  cost: true,
  projectId: true,
  userId: true,
});

export const insertInviteSchema = createInsertSchema(invites).pick({
  organizationId: true,
  email: true,
  role: true,
  token: true,
  expiresAt: true,
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).pick({
  organizationId: true,
  plan: true,
  status: true,
  renewalAt: true,
  seats: true,
  providerCustomerId: true,
});

// Embedding cache for avoiding duplicate API calls
export const embeddingCache = pgTable("embedding_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentHash: text("content_hash").notNull().unique(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  model: text("model").notNull().default("text-embedding-3-small"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Retrieval sessions to track which chunks were used in generation
export const retrievalSessions = pgTable("retrieval_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").references(() => grantQuestions.id, { onDelete: "cascade" }).notNull(),
  queryText: text("query_text").notNull(),
  retrievedChunks: jsonb("retrieved_chunks").notNull(), // Array of chunk IDs with similarity scores
  contextUsed: text("context_used").notNull(),
  retrievalTimeMs: integer("retrieval_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  defaultTone: true,
  lengthPreference: true,
  emphasisAreas: true,
  aiModel: true,
  fallbackModel: true,
  creativity: true,
  contextUsage: true,
  emailNotifications: true,
  autoSave: true,
  analytics: true,
  autoDetection: true,
});

export const insertEmbeddingCacheSchema = createInsertSchema(embeddingCache).pick({
  contentHash: true,
  content: true,
  embedding: true,
  model: true,
});

export const insertRetrievalSessionSchema = createInsertSchema(retrievalSessions).pick({
  questionId: true,
  queryText: true,
  retrievedChunks: true,
  contextUsed: true,
  retrievalTimeMs: true,
});

// Budget settings for cost control
export const budgetSettings = pgTable("budget_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull().unique(),
  monthlyBudget: integer("monthly_budget"), // in cents
  alertThresholds: jsonb("alert_thresholds").default(sql`'{"warning": 80, "critical": 95}'`),
  spikeDetection: jsonb("spike_detection").default(sql`'{"enabled": true, "threshold": 200}'`),
  emailAlerts: boolean("email_alerts").default(true),
  slackWebhook: text("slack_webhook"),
  autoLimits: jsonb("auto_limits").default(sql`'{"enabled": false, "pauseAt": 100}'`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Budget alerts for notifications
export const budgetAlerts = pgTable("budget_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  type: text("type").notNull(), // budget_warning, budget_exceeded, usage_spike, etc.
  severity: text("severity").notNull(), // info, warning, critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  threshold: integer("threshold"),
  currentValue: integer("current_value").notNull(),
  recommendations: jsonb("recommendations").default(sql`'[]'`),
  triggered: boolean("triggered").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
});

// Usage snapshots for historical tracking
export const usageSnapshots = pgTable("usage_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  period: text("period").notNull(), // YYYY-MM format
  projectsCreated: integer("projects_created").default(0),
  documentsUploaded: integer("documents_uploaded").default(0),
  tokensUsed: integer("tokens_used").default(0),
  estimatedCost: integer("estimated_cost").default(0), // in cents
  aiCreditsUsed: integer("ai_credits_used").default(0),
  apiCalls: integer("api_calls").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePeriod: sql`UNIQUE(${table.organizationId}, ${table.period})`,
}));

// Optimization recommendations
export const optimizationRecommendations = pgTable("optimization_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  type: text("type").notNull(), // cost_reduction, performance_improvement, etc.
  priority: text("priority").notNull(), // critical, high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  impact: jsonb("impact").notNull(), // { costSavings, performanceGain, efficiencyGain }
  implementation: jsonb("implementation").notNull(), // { difficulty, timeRequired, steps }
  evidence: jsonb("evidence").notNull(), // { currentState, potentialState, dataPoints }
  tags: text("tags").array(),
  status: text("status").default("pending"), // pending, implemented, dismissed
  implementedAt: timestamp("implemented_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBudgetSettingsSchema = createInsertSchema(budgetSettings).pick({
  organizationId: true,
  monthlyBudget: true,
  alertThresholds: true,
  spikeDetection: true,
  emailAlerts: true,
  slackWebhook: true,
  autoLimits: true,
});

export const insertBudgetAlertSchema = createInsertSchema(budgetAlerts).pick({
  organizationId: true,
  type: true,
  severity: true,
  title: true,
  message: true,
  threshold: true,
  currentValue: true,
  recommendations: true,
  triggered: true,
  metadata: true,
});

export const insertUsageSnapshotSchema = createInsertSchema(usageSnapshots).pick({
  organizationId: true,
  period: true,
  projectsCreated: true,
  documentsUploaded: true,
  tokensUsed: true,
  estimatedCost: true,
  aiCreditsUsed: true,
  apiCalls: true,
});

export const insertOptimizationRecommendationSchema = createInsertSchema(optimizationRecommendations).pick({
  organizationId: true,
  type: true,
  priority: true,
  title: true,
  description: true,
  impact: true,
  implementation: true,
  evidence: true,
  tags: true,
  status: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type DocChunk = typeof docChunks.$inferSelect;
export type InsertDocChunk = z.infer<typeof insertDocChunkSchema>;
export type KnowledgeProfile = typeof knowledgeProfile.$inferSelect;
export type InsertKnowledgeProfile = z.infer<typeof insertKnowledgeProfileSchema>;
export type GrantTemplate = typeof grantTemplates.$inferSelect;
export type InsertGrantTemplate = z.infer<typeof insertGrantTemplateSchema>;
export type GrantQuestion = typeof grantQuestions.$inferSelect;
export type InsertGrantQuestion = z.infer<typeof insertGrantQuestionSchema>;
export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type DraftCitation = typeof draftCitations.$inferSelect;
export type InsertDraftCitation = z.infer<typeof insertDraftCitationSchema>;
export type ClarificationSession = typeof clarificationSessions.$inferSelect;
export type InsertClarificationSession = z.infer<typeof insertClarificationSessionSchema>;
export type ClarificationQuestion = typeof clarificationQuestions.$inferSelect;
export type InsertClarificationQuestion = z.infer<typeof insertClarificationQuestionSchema>;
export type ClarificationAnswer = typeof clarificationAnswers.$inferSelect;
export type InsertClarificationAnswer = z.infer<typeof insertClarificationAnswerSchema>;
export type AssumptionLabel = typeof assumptionLabels.$inferSelect;
export type InsertAssumptionLabel = z.infer<typeof insertAssumptionLabelSchema>;
export type Clarification = typeof clarifications.$inferSelect;
export type InsertClarification = z.infer<typeof insertClarificationSchema>;
export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type Invite = typeof invites.$inferSelect;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type ResponseVersion = typeof responseVersions.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type EmbeddingCache = typeof embeddingCache.$inferSelect;
export type InsertEmbeddingCache = z.infer<typeof insertEmbeddingCacheSchema>;
export type RetrievalSession = typeof retrievalSessions.$inferSelect;
export type InsertRetrievalSession = z.infer<typeof insertRetrievalSessionSchema>;
