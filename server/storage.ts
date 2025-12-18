import {
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Document,
  type InsertDocument,
  type GrantQuestion,
  type InsertGrantQuestion,
  type ResponseVersion,
  type UserSettings,
  type InsertUserSettings,
  type DocumentExtraction,
  type DocumentProcessingJob,
  type DocChunk,
  type DraftCitation,
  type InsertDraftCitation,
  type AssumptionLabel,
  type InsertAssumptionLabel,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema, sql as rawSql } from "./db";
import { eq, and, asc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail?(email: string): Promise<User | undefined>;
  getUserByGoogleId?(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;

  // Project methods
  getProjects(userId: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(userId: string, project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Document methods
  getDocuments(userId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(userId: string, document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  setDocumentExtraction(
    documentId: string,
    data: {
      rawText: string;
      rawTextBytes: number;
      extractionStatus: string;
      extractionError?: string | null;
    }
  ): Promise<void>;
  getDocumentExtraction(documentId: string): Promise<DocumentExtraction | undefined>;
  createProcessingJob(
    documentId: string,
    jobType: string,
    initialStatus?: string
  ): Promise<DocumentProcessingJob>;
  updateProcessingJob(
    jobId: string,
    updates: Partial<DocumentProcessingJob>
  ): Promise<DocumentProcessingJob | undefined>;
  getProcessingJobs(options: {
    jobType: string;
    status?: string;
    limit?: number;
  }): Promise<DocumentProcessingJob[]>;
  deleteChunksForDocument(documentId: string): Promise<void>;
  insertDocChunk(
    documentId: string,
    data: {
      chunkIndex: number;
      content: string;
      tokenCount: number;
      sectionLabel?: string | null;
      embedding?: number[] | null;
    }
  ): Promise<void>;
  searchDocChunksByEmbedding(
    userId: string,
    embedding: number[],
    limit: number
  ): Promise<Array<{ chunk: DocChunk; document: Document; similarity?: number }>>;
  searchDocChunksByKeyword(
    userId: string,
    keywords: string,
    limit: number
  ): Promise<Array<{ chunk: DocChunk; document: Document; similarity?: number }>>;
  createDraftCitation(citation: InsertDraftCitation): Promise<DraftCitation>;
  getDraftCitations(draftId: string): Promise<DraftCitation[]>;
  deleteDraftCitations(draftId: string): Promise<void>;
  createAssumptionLabel(label: InsertAssumptionLabel): Promise<AssumptionLabel>;
  getAssumptionLabels(projectId: string, draftId?: string): Promise<AssumptionLabel[]>;
  deleteAssumptionLabels(projectId: string, draftId?: string): Promise<void>;
  getProcessingJobs(options: {
    jobType: string;
    status?: string;
    limit?: number;
  }): Promise<DocumentProcessingJob[]>;
  deleteChunksForDocument(documentId: string): Promise<void>;
  insertDocChunk(
    documentId: string,
    data: {
      chunkIndex: number;
      content: string;
      tokenCount: number;
      sectionLabel?: string | null;
      embedding?: number[] | null;
    }
  ): Promise<void>;

  // Grant Question methods
  getGrantQuestions(projectId: string): Promise<GrantQuestion[]>;
  getGrantQuestion(id: string): Promise<GrantQuestion | undefined>;
  createGrantQuestion(projectId: string, question: InsertGrantQuestion): Promise<GrantQuestion>;
  updateGrantQuestion(id: string, updates: Partial<GrantQuestion>): Promise<GrantQuestion | undefined>;
  deleteGrantQuestion(id: string): Promise<boolean>;

  // Response Version methods
  getResponseVersions(questionId: string): Promise<ResponseVersion[]>;
  createResponseVersion(questionId: string, content: string, tone: string, version: number): Promise<ResponseVersion>;
  setCurrentVersion(questionId: string, versionId: string): Promise<boolean>;

  // User Settings methods
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(userId: string, settings: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined>;

  // Stats methods
  getUserStats(userId: string): Promise<{
    activeProjects: number;
    successRate: string;
    totalAwarded: string;
    dueThisWeek: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private projects: Map<string, Project> = new Map();
  private documents: Map<string, Document> = new Map();
  private grantQuestions: Map<string, GrantQuestion> = new Map();
  private responseVersions: Map<string, ResponseVersion> = new Map();
  private userSettings: Map<string, UserSettings> = new Map();
  private documentExtractions: Map<string, DocumentExtraction> = new Map();
  private documentProcessingJobs: Map<string, DocumentProcessingJob> = new Map();
  private documentChunks: Map<string, DocChunk[]> = new Map();
  private draftCitations: Map<string, DraftCitation[]> = new Map();
  private assumptionLabels: Map<string, AssumptionLabel[]> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.googleId === googleId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getProjects(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.userId === userId);
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(userId: string, insertProject: InsertProject): Promise<Project> {
    const id = randomUUID();
    const project: Project = {
      ...insertProject,
      id,
      userId,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.projects.set(id, project);
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    
    const updatedProject = { ...project, ...updates, updatedAt: new Date() };
    this.projects.set(id, updatedProject);
    return updatedProject;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async getDocuments(userId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(d => d.userId === userId);
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async createDocument(userId: string, insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const now = new Date();
    const document: Document = {
      ...insertDocument,
      id,
      userId,
      organizationId: insertDocument.organizationId || userId,
      processed: insertDocument.processed ?? false,
      processingStatus: insertDocument.processingStatus || "pending",
      storageBucket: insertDocument.storageBucket || "documents",
      storagePath: insertDocument.storagePath || null,
      storageUrl: insertDocument.storageUrl || null,
      uploadedAt: now,
      processedAt: insertDocument.processedAt ?? null,
      summaryExtractedAt: insertDocument.summaryExtractedAt ?? null,
      embeddingGeneratedAt: insertDocument.embeddingGeneratedAt ?? null,
      processingError: insertDocument.processingError ?? null,
      summary: insertDocument.summary ?? null,
      chunkCount: insertDocument.chunkCount ?? 0,
      embeddingModel: insertDocument.embeddingModel ?? null,
      embeddingStatus: insertDocument.embeddingStatus ?? "pending",
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updatedDocument = { ...document, ...updates };
    this.documents.set(id, updatedDocument);
    return updatedDocument;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const deleted = this.documents.delete(id);
    if (deleted) {
      this.documentExtractions.delete(id);
      Array.from(this.documentProcessingJobs.values())
        .filter((job) => job.documentId === id)
        .forEach((job) => this.documentProcessingJobs.delete(job.id));
    }
    return deleted;
  }

  async setDocumentExtraction(
    documentId: string,
    data: {
      rawText: string;
      rawTextBytes: number;
      extractionStatus: string;
      extractionError?: string | null;
    }
  ): Promise<void> {
    this.documentExtractions.set(documentId, {
      documentId,
      rawText: data.rawText,
      rawTextBytes: data.rawTextBytes,
      extractionStatus: data.extractionStatus,
      extractionError: data.extractionError ?? null,
      extractedAt: new Date(),
    } as DocumentExtraction);
  }

  async getDocumentExtraction(documentId: string): Promise<DocumentExtraction | undefined> {
    return this.documentExtractions.get(documentId);
  }

  async createProcessingJob(
    documentId: string,
    jobType: string,
    initialStatus = "queued"
  ): Promise<DocumentProcessingJob> {
    const id = randomUUID();
    const now = new Date();
    const job: DocumentProcessingJob = {
      id,
      documentId,
      jobType,
      status: initialStatus,
      attempts: 0,
      lastError: null,
      startedAt: initialStatus === "running" ? now : null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.documentProcessingJobs.set(id, job);
    return job;
  }

  async updateProcessingJob(
    jobId: string,
    updates: Partial<DocumentProcessingJob>
  ): Promise<DocumentProcessingJob | undefined> {
    const job = this.documentProcessingJobs.get(jobId);
    if (!job) return undefined;
    const updated: DocumentProcessingJob = {
      ...job,
      ...updates,
      updatedAt: new Date(),
    };
    this.documentProcessingJobs.set(jobId, updated);
    return updated;
  }

  async getProcessingJobs(options: {
    jobType: string;
    status?: string;
    limit?: number;
  }): Promise<DocumentProcessingJob[]> {
    const { jobType, status, limit } = options;
    const jobs = Array.from(this.documentProcessingJobs.values()).filter((job) => {
      if (job.jobType !== jobType) return false;
      if (status && job.status !== status) return false;
      return true;
    });
    return typeof limit === "number" ? jobs.slice(0, limit) : jobs;
  }

  async deleteChunksForDocument(documentId: string): Promise<void> {
    this.documentChunks.delete(documentId);
  }

  async insertDocChunk(
    documentId: string,
    data: {
      chunkIndex: number;
      content: string;
      tokenCount: number;
      sectionLabel?: string | null;
      embedding?: number[] | null;
    }
  ): Promise<void> {
    const chunks = this.documentChunks.get(documentId) || [];
    const chunk: DocChunk = {
      id: randomUUID(),
      documentId,
      chunkIndex: data.chunkIndex,
      content: data.content,
      tokenCount: data.tokenCount,
      sectionLabel: data.sectionLabel ?? null,
      embedding: data.embedding ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as DocChunk;
    chunks.push(chunk);
    this.documentChunks.set(documentId, chunks);
  }

  async createDraftCitation(citation: InsertDraftCitation): Promise<DraftCitation> {
    const id = randomUUID();
    const entry: DraftCitation = {
      ...(citation as DraftCitation),
      id,
      chunkRefs: citation.chunkRefs ?? [],
      createdAt: new Date(),
    };
    const existing = this.draftCitations.get(citation.draftId) || [];
    existing.push(entry);
    this.draftCitations.set(citation.draftId, existing);
    return entry;
  }

  async getDraftCitations(draftId: string): Promise<DraftCitation[]> {
    return this.draftCitations.get(draftId) || [];
  }

  async deleteDraftCitations(draftId: string): Promise<void> {
    this.draftCitations.delete(draftId);
  }

  async createAssumptionLabel(label: InsertAssumptionLabel): Promise<AssumptionLabel> {
    const id = randomUUID();
    const entry: AssumptionLabel = {
      ...(label as AssumptionLabel),
      id,
      resolved: label.resolved ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const existing = this.assumptionLabels.get(label.projectId) || [];
    existing.push(entry);
    this.assumptionLabels.set(label.projectId, existing);
    return entry;
  }

  async getAssumptionLabels(projectId: string, draftId?: string): Promise<AssumptionLabel[]> {
    const entries = this.assumptionLabels.get(projectId) || [];
    return draftId ? entries.filter((assumption) => assumption.draftId === draftId) : entries;
  }

  async deleteAssumptionLabels(projectId: string, draftId?: string): Promise<void> {
    if (!draftId) {
      this.assumptionLabels.delete(projectId);
      return;
    }
    const entries = this.assumptionLabels.get(projectId) || [];
    this.assumptionLabels.set(
      projectId,
      entries.filter((assumption) => assumption.draftId !== draftId)
    );
  }

  async searchDocChunksByEmbedding(
    userId: string,
    embedding: number[],
    limit: number
  ): Promise<Array<{ chunk: DocChunk; document: Document; similarity?: number }>> {
    const docMap = Array.from(this.documents.values()).filter((d) => d.userId === userId);
    const docLookup = new Map(docMap.map((doc) => [doc.id, doc]));
    const allChunks: Array<{ chunk: DocChunk; document: Document; similarity?: number }> = [];

    for (const doc of docMap) {
      const chunks = this.documentChunks.get(doc.id) || [];
      for (const chunk of chunks) {
        if (!chunk.embedding) continue;
        const similarity =
          chunk.embedding.reduce((sum, value, index) => sum + value * (embedding[index] ?? 0), 0) ||
          0;
        allChunks.push({
          chunk,
          document: doc,
          similarity,
        });
      }
    }

    return allChunks
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
      .slice(0, limit);
  }

  async searchDocChunksByKeyword(
    userId: string,
    keywords: string,
    limit: number
  ): Promise<Array<{ chunk: DocChunk; document: Document; similarity?: number }>> {
    const lower = keywords.toLowerCase();
    const docMap = Array.from(this.documents.values()).filter((d) => d.userId === userId);
    const results: Array<{ chunk: DocChunk; document: Document; similarity?: number }> = [];

    for (const doc of docMap) {
      const chunks = this.documentChunks.get(doc.id) || [];
      for (const chunk of chunks) {
        if (chunk.content.toLowerCase().includes(lower)) {
          results.push({
            chunk,
            document: doc,
            similarity: 0.5,
          });
        }
      }
    }

    return results.slice(0, limit);
  }

  async getGrantQuestions(projectId: string): Promise<GrantQuestion[]> {
    return Array.from(this.grantQuestions.values()).filter(q => q.projectId === projectId);
  }

  async getGrantQuestion(id: string): Promise<GrantQuestion | undefined> {
    return this.grantQuestions.get(id);
  }

  async createGrantQuestion(projectId: string, insertQuestion: InsertGrantQuestion): Promise<GrantQuestion> {
    const id = randomUUID();
    const question: GrantQuestion = {
      ...insertQuestion,
      id,
      projectId,
      responseStatus: "pending",
      createdAt: new Date()
    };
    this.grantQuestions.set(id, question);
    return question;
  }

  async updateGrantQuestion(id: string, updates: Partial<GrantQuestion>): Promise<GrantQuestion | undefined> {
    const question = this.grantQuestions.get(id);
    if (!question) return undefined;
    
    const updatedQuestion = { ...question, ...updates };
    this.grantQuestions.set(id, updatedQuestion);
    return updatedQuestion;
  }

  async deleteGrantQuestion(id: string): Promise<boolean> {
    return this.grantQuestions.delete(id);
  }

  async getResponseVersions(questionId: string): Promise<ResponseVersion[]> {
    return Array.from(this.responseVersions.values()).filter(v => v.questionId === questionId);
  }

  async createResponseVersion(questionId: string, content: string, tone: string, version: number): Promise<ResponseVersion> {
    const id = randomUUID();
    const responseVersion: ResponseVersion = {
      id,
      questionId,
      content,
      tone,
      wordCount: content.split(' ').length,
      version,
      isCurrent: true,
      createdAt: new Date()
    };
    
    // Mark other versions as not current
    Array.from(this.responseVersions.values())
      .filter(v => v.questionId === questionId)
      .forEach(v => {
        v.isCurrent = false;
        this.responseVersions.set(v.id, v);
      });
    
    this.responseVersions.set(id, responseVersion);
    return responseVersion;
  }

  async setCurrentVersion(questionId: string, versionId: string): Promise<boolean> {
    const versions = Array.from(this.responseVersions.values()).filter(v => v.questionId === questionId);
    
    versions.forEach(v => {
      v.isCurrent = v.id === versionId;
      this.responseVersions.set(v.id, v);
    });
    
    return true;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    return Array.from(this.userSettings.values()).find(s => s.userId === userId);
  }

  async createUserSettings(userId: string, settings: InsertUserSettings): Promise<UserSettings> {
    const id = randomUUID();
    const userSettings: UserSettings = {
      id,
      userId,
      defaultTone: settings.defaultTone || null,
      lengthPreference: settings.lengthPreference || null,
      emphasisAreas: settings.emphasisAreas || null,
      aiModel: settings.aiModel || null,
      fallbackModel: settings.fallbackModel || null,
      creativity: settings.creativity || null,
      contextUsage: settings.contextUsage || null,
      emailNotifications: settings.emailNotifications || null,
      autoSave: settings.autoSave || null,
      analytics: settings.analytics || null,
      autoDetection: settings.autoDetection || null,
      updatedAt: new Date()
    };
    this.userSettings.set(id, userSettings);
    return userSettings;
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const settings = Array.from(this.userSettings.values()).find(s => s.userId === userId);
    if (!settings) return undefined;
    
    const updatedSettings = { ...settings, ...updates, updatedAt: new Date() };
    this.userSettings.set(settings.id, updatedSettings);
    return updatedSettings;
  }

  async getUserStats(userId: string): Promise<{
    activeProjects: number;
    successRate: string;
    totalAwarded: string;
    dueThisWeek: number;
  }> {
    const projects = await this.getProjects(userId);
    const activeProjects = projects.filter(p => p.status === "draft" || p.status === "submitted").length;
    
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    
    const dueThisWeek = projects.filter(p => 
      p.deadline && new Date(p.deadline) <= oneWeekFromNow && p.status !== "awarded" && p.status !== "declined"
    ).length;

    return {
      activeProjects,
      successRate: "67%", // This would be calculated from historical data
      totalAwarded: "$2.4M", // This would be calculated from awarded grants
      dueThisWeek
    };
  }
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const rows = await db?.select().from(schema.users).where(eq(schema.users.id, id));
    return rows?.[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db?.select().from(schema.users).where(eq(schema.users.username, username));
    return rows?.[0];
  }

  async createUser(insertUser: InsertUser & { passwordHash?: string; passwordSalt?: string }): Promise<User> {
    const toInsert: any = {
      username: insertUser.username,
      password: insertUser.passwordHash ? `${insertUser.passwordHash}:${insertUser.passwordSalt}` : insertUser.password,
      organizationName: (insertUser as any).organizationName,
    };
    const rows = await db?.insert(schema.users).values(toInsert).returning();
    return rows![0];
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const rows = await db?.update(schema.users).set(updates as any).where(eq(schema.users.id, id)).returning();
    return rows?.[0];
  }

  async getProjects(userId: string): Promise<Project[]> {
    const rows = await db?.select().from(schema.projects).where(eq(schema.projects.userId, userId));
    return rows || [];
  }

  async getProject(id: string): Promise<Project | undefined> {
    const rows = await db?.select().from(schema.projects).where(eq(schema.projects.id, id));
    return rows?.[0];
  }

  async createProject(userId: string, insertProject: InsertProject): Promise<Project> {
    // Use userId as organizationId for now (until proper multi-tenancy is implemented)
    const rows = await db?.insert(schema.projects).values({ 
      ...(insertProject as any), 
      userId,
      organizationId: userId 
    }).returning();
    return rows![0];
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const rows = await db?.update(schema.projects).set(updates as any).where(eq(schema.projects.id, id)).returning();
    return rows?.[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const rows = await db?.delete(schema.projects).where(eq(schema.projects.id, id)).returning();
    return !!rows?.length;
  }

  async getDocuments(userId: string): Promise<Document[]> {
    const rows = await db?.select().from(schema.documents).where(eq(schema.documents.userId, userId));
    return rows || [];
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const rows = await db?.select().from(schema.documents).where(eq(schema.documents.id, id));
    return rows?.[0];
  }

  async createDocument(userId: string, insertDocument: InsertDocument): Promise<Document> {
    const values: InsertDocument & { organizationId?: string } = {
      ...insertDocument,
      organizationId: insertDocument.organizationId || userId,
    };
    const rows = await db?.insert(schema.documents).values({ ...(values as any), userId }).returning();
    return rows![0];
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const rows = await db?.update(schema.documents).set(updates as any).where(eq(schema.documents.id, id)).returning();
    return rows?.[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const rows = await db
      ?.delete(schema.documents)
      .where(eq(schema.documents.id, id))
      .returning();
    return !!rows?.length;
  }

  async setDocumentExtraction(
    documentId: string,
    data: {
      rawText: string;
      rawTextBytes: number;
      extractionStatus: string;
      extractionError?: string | null;
    }
  ): Promise<void> {
    if (!db) return;
    const existing = await db
      .select()
      .from(schema.documentExtractions)
      .where(eq(schema.documentExtractions.documentId, documentId));

    if (existing && existing.length > 0) {
      await db
        .update(schema.documentExtractions)
        .set({
          rawText: data.rawText,
          rawTextBytes: data.rawTextBytes,
          extractionStatus: data.extractionStatus,
          extractionError: data.extractionError ?? null,
          extractedAt: new Date(),
        })
        .where(eq(schema.documentExtractions.documentId, documentId));
    } else {
      await db.insert(schema.documentExtractions).values({
        documentId,
        rawText: data.rawText,
        rawTextBytes: data.rawTextBytes,
        extractionStatus: data.extractionStatus,
        extractionError: data.extractionError ?? null,
      });
    }
  }

  async getDocumentExtraction(documentId: string): Promise<DocumentExtraction | undefined> {
    const rows = await db
      ?.select()
      .from(schema.documentExtractions)
      .where(eq(schema.documentExtractions.documentId, documentId));
    return rows?.[0];
  }

  async createProcessingJob(
    documentId: string,
    jobType: string,
    initialStatus = "queued"
  ): Promise<DocumentProcessingJob> {
    const rows = await db
      ?.insert(schema.documentProcessingJobs)
      .values({
        documentId,
        jobType,
        status: initialStatus,
        attempts: 0,
        startedAt: initialStatus === "running" ? new Date() : null,
      })
      .returning();
    return rows![0];
  }

  async updateProcessingJob(
    jobId: string,
    updates: Partial<DocumentProcessingJob>
  ): Promise<DocumentProcessingJob | undefined> {
    const rows = await db
      ?.update(schema.documentProcessingJobs)
      .set({ ...(updates as any), updatedAt: new Date() })
      .where(eq(schema.documentProcessingJobs.id, jobId))
      .returning();
    return rows?.[0];
  }

  async getProcessingJobs(options: {
    jobType: string;
    status?: string;
    limit?: number;
  }): Promise<DocumentProcessingJob[]> {
    if (!db) return [];
    const { jobType, status, limit = 10 } = options;
    let whereClause = eq(schema.documentProcessingJobs.jobType, jobType);
    if (status) {
      whereClause = and(whereClause, eq(schema.documentProcessingJobs.status, status));
    }
    const rows = await db
      .select()
      .from(schema.documentProcessingJobs)
      .where(whereClause)
      .limit(limit)
      .orderBy(asc(schema.documentProcessingJobs.createdAt));
    return rows || [];
  }

  async deleteChunksForDocument(documentId: string): Promise<void> {
    await db?.delete(schema.docChunks).where(eq(schema.docChunks.documentId, documentId));
  }

  async insertDocChunk(
    documentId: string,
    data: {
      chunkIndex: number;
      content: string;
      tokenCount: number;
      sectionLabel?: string | null;
      embedding?: number[] | null;
    }
  ): Promise<void> {
    await db?.insert(schema.docChunks).values({
      id: randomUUID(),
      documentId,
      chunkIndex: data.chunkIndex,
      content: data.content,
      tokenCount: data.tokenCount,
      sectionLabel: data.sectionLabel ?? null,
      embedding: data.embedding ?? null,
    } as any);
  }

  async createDraftCitation(citation: InsertDraftCitation): Promise<DraftCitation> {
    const rows = await db
      ?.insert(schema.draftCitations)
      .values(citation as any)
      .returning();
    return rows![0];
  }

  async getDraftCitations(draftId: string): Promise<DraftCitation[]> {
    const rows = await db
      ?.select()
      .from(schema.draftCitations)
      .where(eq(schema.draftCitations.draftId, draftId));
    return rows || [];
  }

  async deleteDraftCitations(draftId: string): Promise<void> {
    await db
      ?.delete(schema.draftCitations)
      .where(eq(schema.draftCitations.draftId, draftId));
  }

  async createAssumptionLabel(label: InsertAssumptionLabel): Promise<AssumptionLabel> {
    const rows = await db
      ?.insert(schema.assumptionLabels)
      .values(label as any)
      .returning();
    return rows![0];
  }

  async getAssumptionLabels(projectId: string, draftId?: string): Promise<AssumptionLabel[]> {
    if (!db) return [];
    let condition = eq(schema.assumptionLabels.projectId, projectId);
    if (draftId) {
      condition = and(condition, eq(schema.assumptionLabels.draftId, draftId));
    }
    const rows = await db
      .select()
      .from(schema.assumptionLabels)
      .where(condition);
    return rows || [];
  }

  async deleteAssumptionLabels(projectId: string, draftId?: string): Promise<void> {
    if (!db) return;
    let condition = eq(schema.assumptionLabels.projectId, projectId);
    if (draftId) {
      condition = and(condition, eq(schema.assumptionLabels.draftId, draftId));
    }
    await db
      .delete(schema.assumptionLabels)
      .where(condition);
  }

  async searchDocChunksByEmbedding(
    userId: string,
    embedding: number[],
    limit: number
  ): Promise<Array<{ chunk: DocChunk; document: Document; similarity?: number }>> {
    if (!rawSql) return [];
    const vectorLiteral = `[${embedding.join(",")}]`;
    const query = `
      SELECT
        dc.id AS chunk_id,
        dc.document_id AS chunk_document_id,
        dc.chunk_index,
        dc.content,
        dc.token_count,
        dc.section_label,
        dc.created_at AS chunk_created_at,
        dc.updated_at AS chunk_updated_at,
        d.id AS document_id,
        d.user_id AS document_user_id,
        d.organization_id,
        d.original_name,
        d.filename,
        d.filename,
        d.summary,
        d.file_type,
        d.file_size,
        d.category,
        d.processing_status,
        d.processing_error,
        d.processed,
        d.processed_at,
        d.summary_extracted_at,
        d.embedding_status,
        d.embedding_generated_at,
        d.embedding_model,
        d.chunk_count,
        d.storage_bucket,
        d.storage_path,
        d.storage_url,
        d.uploaded_at,
        1 - (dc.embedding <=> '${vectorLiteral}'::vector) AS similarity
      FROM doc_chunks dc
      INNER JOIN documents d ON d.id = dc.document_id
      WHERE d.user_id = $1
      ORDER BY dc.embedding <=> '${vectorLiteral}'::vector
      LIMIT $2;
    `;
    const result = await rawSql(query, [userId, limit]);
    return (result?.rows || []).map((row: any) => ({
      chunk: {
        id: row.chunk_id,
        documentId: row.chunk_document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        tokenCount: row.token_count,
        sectionLabel: row.section_label,
        embedding: null,
        createdAt: row.chunk_created_at,
        updatedAt: row.chunk_updated_at,
      } as DocChunk,
      document: {
        id: row.document_id,
        userId: row.document_user_id,
        organizationId: row.organization_id,
        filename: row.filename,
        originalName: row.original_name,
        summary: row.summary,
        fileType: row.file_type,
        fileSize: row.file_size,
        category: row.category,
        processingStatus: row.processing_status,
        processingError: row.processing_error,
        processed: row.processed,
        processedAt: row.processed_at,
        summaryExtractedAt: row.summary_extracted_at,
        embeddingStatus: row.embedding_status,
        embeddingGeneratedAt: row.embedding_generated_at,
        embeddingModel: row.embedding_model,
        chunkCount: row.chunk_count,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        storageUrl: row.storage_url,
        uploadedAt: row.uploaded_at,
      } as Document,
      similarity: typeof row.similarity === "number" ? row.similarity : undefined,
    }));
  }

  async searchDocChunksByKeyword(
    userId: string,
    keywords: string,
    limit: number
  ): Promise<Array<{ chunk: DocChunk; document: Document; similarity?: number }>> {
    if (!rawSql) return [];
    const result = await rawSql(
      `
      SELECT
        dc.id AS chunk_id,
        dc.document_id AS chunk_document_id,
        dc.chunk_index,
        dc.content,
        dc.token_count,
        dc.section_label,
        dc.created_at AS chunk_created_at,
        dc.updated_at AS chunk_updated_at,
        d.id AS document_id,
        d.user_id AS document_user_id,
        d.organization_id,
        d.original_name,
        d.summary,
        d.file_type,
        d.file_size,
        d.category,
        d.processing_status,
        d.processing_error,
        d.processed,
        d.processed_at,
        d.summary_extracted_at,
        d.embedding_status,
        d.embedding_generated_at,
        d.embedding_model,
        d.chunk_count,
        d.storage_bucket,
        d.storage_path,
        d.storage_url,
        d.uploaded_at
      FROM doc_chunks dc
      INNER JOIN documents d ON d.id = dc.document_id
      WHERE d.user_id = $1
        AND dc.content ILIKE $2
      ORDER BY dc.updated_at DESC
      LIMIT $3;
    `,
      [userId, `%${keywords}%`, limit]
    );

    return (result?.rows || []).map((row: any) => ({
      chunk: {
        id: row.chunk_id,
        documentId: row.chunk_document_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        tokenCount: row.token_count,
        sectionLabel: row.section_label,
        embedding: null,
        createdAt: row.chunk_created_at,
        updatedAt: row.chunk_updated_at,
      } as DocChunk,
      document: {
        id: row.document_id,
        userId: row.document_user_id,
        organizationId: row.organization_id,
        filename: row.filename,
        originalName: row.original_name,
        summary: row.summary,
        fileType: row.file_type,
        fileSize: row.file_size,
        category: row.category,
        processingStatus: row.processing_status,
        processingError: row.processing_error,
        processed: row.processed,
        processedAt: row.processed_at,
        summaryExtractedAt: row.summary_extracted_at,
        embeddingStatus: row.embedding_status,
        embeddingGeneratedAt: row.embedding_generated_at,
        embeddingModel: row.embedding_model,
        chunkCount: row.chunk_count,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        storageUrl: row.storage_url,
        uploadedAt: row.uploaded_at,
      } as Document,
      similarity: undefined,
    }));
  }

  async getGrantQuestions(projectId: string): Promise<GrantQuestion[]> {
    const rows = await db?.select().from(schema.grantQuestions).where(eq(schema.grantQuestions.projectId, projectId));
    return rows || [];
  }

  async getGrantQuestion(id: string): Promise<GrantQuestion | undefined> {
    const rows = await db?.select().from(schema.grantQuestions).where(eq(schema.grantQuestions.id, id));
    return rows?.[0];
  }

  async createGrantQuestion(projectId: string, insertQuestion: InsertGrantQuestion): Promise<GrantQuestion> {
    const rows = await db?.insert(schema.grantQuestions).values({ ...(insertQuestion as any), projectId }).returning();
    return rows![0];
  }

  async updateGrantQuestion(id: string, updates: Partial<GrantQuestion>): Promise<GrantQuestion | undefined> {
    const rows = await db?.update(schema.grantQuestions).set(updates as any).where(eq(schema.grantQuestions.id, id)).returning();
    return rows?.[0];
  }

  async deleteGrantQuestion(id: string): Promise<boolean> {
    const rows = await db?.delete(schema.grantQuestions).where(eq(schema.grantQuestions.id, id)).returning();
    return !!rows?.length;
  }

  async getResponseVersions(questionId: string): Promise<ResponseVersion[]> {
    const rows = await db?.select().from(schema.responseVersions).where(eq(schema.responseVersions.questionId, questionId));
    return rows || [];
  }

  async createResponseVersion(questionId: string, content: string, tone: string, version: number): Promise<ResponseVersion> {
    const rows = await db?.insert(schema.responseVersions).values({ questionId, content, tone, version, wordCount: content.split(' ').length, isCurrent: true }).returning();
    return rows![0];
  }

  async setCurrentVersion(questionId: string, versionId: string): Promise<boolean> {
    const versions = await this.getResponseVersions(questionId);
    for (const v of versions) {
      await db?.update(schema.responseVersions).set({ isCurrent: v.id === versionId }).where(eq(schema.responseVersions.id, v.id));
    }
    return true;
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const rows = await db?.select().from(schema.userSettings).where(eq(schema.userSettings.userId, userId));
    return rows?.[0];
  }

  async createUserSettings(userId: string, settings: InsertUserSettings): Promise<UserSettings> {
    const rows = await db?.insert(schema.userSettings).values({ ...(settings as any), userId }).returning();
    return rows![0];
  }

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings | undefined> {
    const existing = await this.getUserSettings(userId);
    if (!existing) return undefined;
    const rows = await db?.update(schema.userSettings).set(updates as any).where(eq(schema.userSettings.id, existing.id)).returning();
    return rows?.[0];
  }

  async getUserStats(userId: string): Promise<{
    activeProjects: number;
    successRate: string;
    totalAwarded: string;
    dueThisWeek: number;
  }> {
    const projects = await this.getProjects(userId);
    const activeProjects = projects.filter(p => p.status === "draft" || p.status === "submitted").length;
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
    const dueThisWeek = projects.filter(p => p.deadline && new Date(p.deadline) <= oneWeekFromNow && p.status !== "awarded" && p.status !== "declined").length;
    return { activeProjects, successRate: "67%", totalAwarded: "$2.4M", dueThisWeek };
  }
}

const useDb = !!process.env.DATABASE_URL;
export const storage: IStorage = useDb ? new DbStorage() : new MemStorage();

if (useDb) {
  console.info("[storage] Using DbStorage with configured DATABASE_URL.");
} else {
  console.warn("[storage] DATABASE_URL not set. Using in-memory storage; data will not persist across restarts.");
}
