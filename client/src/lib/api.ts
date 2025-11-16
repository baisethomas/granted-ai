import { apiRequest, API_BASE_URL } from "./queryClient";

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
  processingStatus: string;
  processingError?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  storageUrl?: string | null;
  processedAt?: string | null;
  summaryExtractedAt?: string | null;
  embeddingGeneratedAt?: string | null;
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
  citations?: Array<{
    documentName: string;
    documentId: string;
    chunkIndex: number;
    quote?: string;
  }>;
  assumptions?: Array<{
    id: string;
    text: string;
    category: string;
    confidence: number;
    suggestedQuestion?: string;
    resolved?: boolean;
  }>;
  retrievedChunks?: Array<{
    documentName: string;
    documentId: string;
    chunkIndex: number;
    content: string;
    similarity?: number;
  }>;
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

export interface User {
  id: string;
  username: string;
  organizationName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: User;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
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

  async finalizeProject(id: string): Promise<Project> {
    const res = await apiRequest("PUT", `/api/projects/${id}/finalize`);
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

    // Get Supabase auth token
    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const url = API_BASE_URL ? `${API_BASE_URL}/api/documents/upload` : "/api/documents/upload";
    const res = await fetch(url, {
      method: "POST",
      headers,
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
    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const url = API_BASE_URL ? `${API_BASE_URL}/api/questions/${questionId}/generate` : `/api/questions/${questionId}/generate`;
    
    // Use longer timeout for AI generation (90 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(options),
        credentials: "include",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle 206 Partial Content as success (with warnings)
      if (res.status === 206) {
        const data = await res.json();
        return data;
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || errorData.message || `Failed to generate response: ${res.statusText}`);
      }
      
      return res.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: AI generation took too long. Please try again.');
      }
      throw error;
    }
  },

  async updateResponse(questionId: string, content: string, preserveVersion = false): Promise<{ id: string; content: string; lastModified: Date; status: string; wordCount: number }> {
    const res = await apiRequest("PUT", `/api/questions/${questionId}/response`, { content, preserveVersion });
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

    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const url = API_BASE_URL ? `${API_BASE_URL}/api/extract-questions` : "/api/extract-questions";
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      headers,
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error(`${res.status}: ${res.statusText}`);
    }

    return res.json();
  },

  // Auth
  async me(): Promise<User> {
    const res = await apiRequest("GET", "/api/auth/me");
    return res.json();
  },

  async login(username: string, password: string): Promise<User> {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    return res.json();
  },

  async signup(username: string, password: string, organizationName?: string): Promise<User> {
    const res = await apiRequest("POST", "/api/auth/signup", { username, password, organizationName });
    return res.json();
  },

  async logout(): Promise<void> {
    await apiRequest("POST", "/api/auth/logout");
  },
};
