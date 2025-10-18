import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, check, vector } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"), // Make nullable for OAuth users
  organizationName: text("organization_name"),
  organizationType: text("organization_type"),
  ein: text("ein"),
  foundedYear: integer("founded_year"),
  primaryContact: text("primary_contact"),
  email: text("email"),
  mission: text("mission"),
  focusAreas: text("focus_areas").array(),
  // Google OAuth fields
  googleId: text("google_id").unique(),
  avatar: text("avatar"),
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
  processed: boolean("processed").default(false),
  summary: text("summary"),
  category: text("category"),
  storageBucket: text("storage_bucket").default("documents"),
  storagePath: text("storage_path"),
  storageUrl: text("storage_url"),
  processingStatus: text("processing_status").default("pending"),
  processingError: text("processing_error"),
  processedAt: timestamp("processed_at"),
  summaryExtractedAt: timestamp("summary_extracted_at"),
  embeddingGeneratedAt: timestamp("embedding_generated_at"),
  embeddingStatus: text("embedding_status").default("pending"),
  chunkCount: integer("chunk_count").default(0),
  embeddingModel: text("embedding_model"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const documentExtractions = pgTable("document_extractions", {
  documentId: varchar("document_id").primaryKey().references(() => documents.id, { onDelete: "cascade" }),
  rawText: text("raw_text"),
  rawTextBytes: integer("raw_text_bytes"),
  extractedAt: timestamp("extracted_at").defaultNow(),
  extractionStatus: text("extraction_status").default("pending"),
  extractionError: text("extraction_error"),
});

export const docChunks = pgTable("doc_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  sectionLabel: text("section_label"),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentProcessingJobs = pgTable("document_processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const embeddingCache = pgTable("embedding_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentHash: text("content_hash").unique().notNull(),
  contentPreview: text("content_preview"),
  embedding: vector("embedding", { dimensions: 1536 }),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  usageCount: integer("usage_count").default(1),
});

export const questions = pgTable("questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  question: text("question").notNull(),
  response: text("response"),
  responseStatus: text("response_status").default("pending"), // pending, generating, complete, failed
  errorMessage: text("error_message"),
  wordLimit: integer("word_limit"),
  priority: text("priority").default("medium"), // high, medium, low
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for validation
export const UserInsertSchema = createInsertSchema(users);
export const OrganizationInsertSchema = createInsertSchema(organizations);
export const ProjectInsertSchema = createInsertSchema(projects);
export const DocumentInsertSchema = createInsertSchema(documents);
export const DocumentExtractionInsertSchema = createInsertSchema(documentExtractions);
export const DocumentProcessingJobInsertSchema = createInsertSchema(documentProcessingJobs);
export const QuestionInsertSchema = createInsertSchema(questions);

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentExtraction = typeof documentExtractions.$inferSelect;
export type DocumentProcessingJob = typeof documentProcessingJobs.$inferSelect;
export type DocChunk = typeof docChunks.$inferSelect;
export type InsertDocChunk = typeof docChunks.$inferInsert;
export type Question = typeof questions.$inferSelect;
