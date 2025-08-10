import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
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
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  category: text("category"), // organization-info, past-successes, budgets, team-info
  summary: text("summary"),
  processed: boolean("processed").default(false),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const grantQuestions = pgTable("grant_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  question: text("question").notNull(),
  wordLimit: integer("word_limit"),
  priority: text("priority").default("medium"), // high, medium, low
  response: text("response"),
  responseStatus: text("response_status").default("pending"), // pending, generating, complete
  createdAt: timestamp("created_at").defaultNow(),
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
});

export const insertGrantQuestionSchema = createInsertSchema(grantQuestions).pick({
  question: true,
  wordLimit: true,
  priority: true,
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type GrantQuestion = typeof grantQuestions.$inferSelect;
export type InsertGrantQuestion = z.infer<typeof insertGrantQuestionSchema>;
export type ResponseVersion = typeof responseVersions.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
