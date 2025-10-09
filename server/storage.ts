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
  type InsertUserSettings
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

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

  reset(): void {
    this.users.clear();
    this.projects.clear();
    this.documents.clear();
    this.grantQuestions.clear();
    this.responseVersions.clear();
    this.userSettings.clear();
  }

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
    const document: Document = {
      ...insertDocument,
      id,
      userId,
      processed: false,
      uploadedAt: new Date()
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
    return this.documents.delete(id);
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
    const rows = await db?.insert(schema.projects).values({ ...(insertProject as any), userId }).returning();
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
    const rows = await db?.insert(schema.documents).values({ ...(insertDocument as any), userId }).returning();
    return rows![0];
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const rows = await db?.update(schema.documents).set(updates as any).where(eq(schema.documents.id, id)).returning();
    return rows?.[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const rows = await db?.delete(schema.documents).where(eq(schema.documents.id, id)).returning();
    return !!rows?.length;
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
