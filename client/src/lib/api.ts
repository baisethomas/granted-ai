import { apiRequest } from "./queryClient";

export interface Project {
  id: string;
  title: string;
  funder: string;
  amount?: string;
  deadline?: string;
  status: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  category?: string;
  summary?: string;
  processed: boolean;
  uploadedAt: Date;
}

export interface GrantQuestion {
  id: string;
  projectId: string;
  question: string;
  wordLimit?: number;
  priority: string;
  response?: string;
  responseStatus: string;
  createdAt: Date;
}

export interface UserSettings {
  id: string;
  userId: string;
  defaultTone: string;
  lengthPreference: string;
  emphasisAreas: string[];
  aiModel: string;
  fallbackModel: string;
  creativity: number;
  contextUsage: number;
  emailNotifications: boolean;
  autoSave: boolean;
  analytics: boolean;
  autoDetection: boolean;
  updatedAt: Date;
}

export interface Stats {
  activeProjects: number;
  successRate: string;
  totalAwarded: string;
  dueThisWeek: number;
}

export const api = {
  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await apiRequest("GET", "/api/projects");
    return res.json();
  },

  async createProject(data: Partial<Project>): Promise<Project> {
    const res = await apiRequest("POST", "/api/projects", data);
    return res.json();
  },

  async getProject(id: string): Promise<Project> {
    const res = await apiRequest("GET", `/api/projects/${id}`);
    return res.json();
  },

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    const res = await apiRequest("PUT", `/api/projects/${id}`, data);
    return res.json();
  },

  // Documents
  async getDocuments(): Promise<Document[]> {
    const res = await apiRequest("GET", "/api/documents");
    return res.json();
  },

  async uploadDocument(file: File, category?: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    if (category) formData.append('category', category);

    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`${res.status}: ${res.statusText}`);
    }

    return res.json();
  },

  async deleteDocument(id: string): Promise<void> {
    await apiRequest("DELETE", `/api/documents/${id}`);
  },

  // Grant Questions
  async getQuestions(projectId: string): Promise<GrantQuestion[]> {
    const res = await apiRequest("GET", `/api/projects/${projectId}/questions`);
    return res.json();
  },

  async createQuestion(projectId: string, data: Partial<GrantQuestion>): Promise<GrantQuestion> {
    const res = await apiRequest("POST", `/api/projects/${projectId}/questions`, data);
    return res.json();
  },

  async generateResponse(questionId: string, options: { tone?: string; emphasisAreas?: string[] }): Promise<GrantQuestion> {
    const res = await apiRequest("POST", `/api/questions/${questionId}/generate`, options);
    return res.json();
  },

  // Settings
  async getSettings(): Promise<UserSettings> {
    const res = await apiRequest("GET", "/api/settings");
    return res.json();
  },

  async updateSettings(data: Partial<UserSettings>): Promise<UserSettings> {
    const res = await apiRequest("PUT", "/api/settings", data);
    return res.json();
  },

  // Stats
  async getStats(): Promise<Stats> {
    const res = await apiRequest("GET", "/api/stats");
    return res.json();
  },

  // File extraction
  async extractQuestions(file: File): Promise<{ questions: string[] }> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch("/api/extract-questions", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`${res.status}: ${res.statusText}`);
    }

    return res.json();
  },
};
