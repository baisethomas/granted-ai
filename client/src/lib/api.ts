import { apiRequest, API_BASE_URL } from "./queryClient";

export interface Project {
  id: string;
  organizationId?: string;
  title: string;
  funder: string;
  amount?: string;
  deadline?: string;
  status: string;
  description?: string;
  amountRequested?: number | null;
  amountAwarded?: number | null;
  awardedAt?: string | null;
  reportingDueAt?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  organizationType?: string | null;
  ein?: string | null;
  foundedYear?: number | null;
  primaryContact?: string | null;
  contactEmail?: string | null;
  mission?: string | null;
  focusAreas?: string[] | null;
  plan?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OrganizationInput = Partial<Omit<Organization, "id" | "createdAt" | "updatedAt">> & {
  name: string;
};

export interface OrganizationProfileSuggestion {
  id: string;
  organizationId: string;
  documentId: string;
  field: string;
  suggestedValue: string;
  confidence?: number | null;
  sourceQuote?: string | null;
  status: "pending" | "accepted" | "rejected" | "dismissed";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MetricType = "number" | "currency" | "percent" | "text" | "date";
export type MetricCategory = "impact" | "financial" | "timeline" | "reporting" | "custom";
export type MetricSource = "manual" | "ai_suggested" | "preset";
export type MetricStatus = "suggested" | "active" | "dismissed";

export interface GrantMetric {
  id: string;
  projectId: string;
  key: string;
  label: string;
  type: MetricType;
  value: string | null;
  target: string | null;
  unit: string | null;
  category: MetricCategory;
  source: MetricSource;
  status: MetricStatus;
  sourceDocumentId: string | null;
  sourceChunkId: string | null;
  confidence: number | null;
  rationale: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectInput = Partial<Omit<Project, "deadline">> & {
  deadline?: string | Date;
};

export interface GrantMetricEvent {
  id: string;
  metricId: string;
  value: string;
  note: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  evidenceUrl: string | null;
  sourceDocumentId: string | null;
  status: "recorded" | "submitted" | "accepted";
  recordedAt: string;
  recordedBy: string | null;
}

export interface RecordMetricEventPayload {
  value: string;
  note?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  evidenceUrl?: string | null;
  sourceDocumentId?: string | null;
  status?: "recorded" | "submitted" | "accepted";
}

export interface RecordMetricEventResponse {
  metric: GrantMetric;
  event: GrantMetricEvent;
}

export interface ApplicationMetrics {
  completionPct: number;
  questionsTotal: number;
  questionsAnswered: number;
  citationsCount: number;
  unresolvedAssumptions: number;
  daysToDeadline: number | null;
  wordLimitUtilization: number | null;
  lastActivityAt: string | null;
}

export interface MetricPreset {
  key: string;
  label: string;
  type: MetricType;
  unit?: string;
  category: MetricCategory;
}

export interface MetricsResponse {
  metrics: GrantMetric[];
  application: ApplicationMetrics;
  presets: MetricPreset[];
  project: {
    id: string;
    amountRequested: number | null;
    amountAwarded: number | null;
    awardedAt: string | null;
    reportingDueAt: string | null;
  };
}

export interface MetricSuggestion {
  key: string;
  label: string;
  type: MetricType;
  unit?: string;
  target?: string;
  category: MetricCategory;
  rationale?: string;
  confidence: number;
}

export interface PortfolioMetricsResponse {
  stats: Stats;
  projects: Array<{
    id: string;
    title: string;
    funder: string;
    status: string;
    deadline: string | null;
    amountRequested: number | null;
    amountAwarded: number | null;
    metricsTracked: number;
    metricsMissingValues: number;
    metricUpdatesInPeriod: number;
  }>;
  totalsByKey: Record<
    string,
    { label: string; unit: string | null; type: string; total: number; count: number }
  >;
  metrics: GrantMetric[];
}

export interface Document {
  id: string;
  organizationId?: string;
  projectId?: string | null;
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
  embeddingStatus?: string | null;
  uploadedAt: Date;
}

export interface GrantQuestion {
  id: string;
  projectId: string;
  question: string;
  content?: string;
  wordLimit?: number;
  priority: string;
  response?: string;
  responseStatus: string;
  status?: string;
  errorMessage?: string;
  warning?: string;
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
  // Organizations / client workspaces
  async getOrganizations(): Promise<Organization[]> {
    const res = await apiRequest("GET", "/api/organizations");
    return res.json();
  },

  async createOrganization(data: OrganizationInput): Promise<Organization> {
    const res = await apiRequest("POST", "/api/organizations", data);
    return res.json();
  },

  async updateOrganization(id: string, data: Partial<OrganizationInput>): Promise<Organization> {
    const res = await apiRequest("PATCH", `/api/organizations/${id}`, data);
    return res.json();
  },

  async deleteOrganization(id: string): Promise<{ success: boolean }> {
    const res = await apiRequest("DELETE", `/api/organizations/${id}`);
    return res.json();
  },

  async getOrganizationProfileSuggestions(organizationId: string): Promise<OrganizationProfileSuggestion[]> {
    const res = await apiRequest("GET", `/api/organizations/${organizationId}/profile-suggestions`);
    return res.json();
  },

  async reviewOrganizationProfileSuggestion(
    organizationId: string,
    suggestionId: string,
    status: "pending" | "accepted" | "rejected" | "dismissed",
  ): Promise<{ suggestion: OrganizationProfileSuggestion; organization: Organization | null }> {
    const res = await apiRequest("POST", `/api/organizations/${organizationId}/profile-suggestions/${suggestionId}/review`, { status });
    return res.json();
  },

  // Projects
  async getProjects(): Promise<Project[]> {
    const res = await apiRequest("GET", "/api/projects");
    return res.json();
  },

  async createProject(data: ProjectInput): Promise<Project> {
    const res = await apiRequest("POST", "/api/projects", data);
    return res.json();
  },

  async getOrganizationProjects(organizationId: string): Promise<Project[]> {
    const res = await apiRequest("GET", `/api/organizations/${organizationId}/projects`);
    return res.json();
  },

  async createOrganizationProject(organizationId: string, data: ProjectInput): Promise<Project> {
    const res = await apiRequest("POST", `/api/organizations/${organizationId}/projects`, data);
    return res.json();
  },

  async getProject(id: string): Promise<Project> {
    const res = await apiRequest("GET", `/api/projects/${id}`);
    return res.json();
  },

  async updateProject(id: string, data: ProjectInput): Promise<Project> {
    const res = await apiRequest("PUT", `/api/projects/${id}`, data);
    return res.json();
  },

  async finalizeProject(id: string): Promise<Project> {
    const res = await apiRequest("PUT", `/api/projects/${id}/finalize`);
    return res.json();
  },

  async deleteProject(id: string): Promise<void> {
    await apiRequest("DELETE", `/api/projects/${id}`);
  },

  // Documents
  async getDocuments(): Promise<Document[]> {
    const res = await apiRequest("GET", "/api/documents");
    return res.json();
  },

  async getOrganizationDocuments(organizationId: string, projectId?: string | null): Promise<Document[]> {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const res = await apiRequest("GET", `/api/organizations/${organizationId}/documents${qs}`);
    return res.json();
  },

  async uploadDocument(file: File, category?: string, opts?: { organizationId?: string; projectId?: string | null }): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    if (category) formData.append('category', category);
    if (opts?.projectId) formData.append('projectId', opts.projectId);

    // Get Supabase auth token
    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const path = opts?.organizationId
      ? `/api/organizations/${opts.organizationId}/documents/upload`
      : "/api/documents/upload";
    const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path;
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

  async getOrganizationStats(organizationId: string): Promise<Stats> {
    const res = await apiRequest("GET", `/api/organizations/${organizationId}/stats`);
    return res.json();
  },

  // File extraction
  async extractQuestions(file: File): Promise<{ questions: string[]; demo?: boolean }> {
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

  // Metrics
  async getProjectMetrics(projectId: string, opts?: { includeDismissed?: boolean }): Promise<MetricsResponse> {
    const qs = opts?.includeDismissed ? "?includeDismissed=true" : "";
    const res = await apiRequest("GET", `/api/projects/${projectId}/metrics${qs}`);
    return res.json();
  },

  async getMetricsReportSummary(projectId: string): Promise<{ text: string; metricsCount: number }> {
    const res = await apiRequest("GET", `/api/projects/${projectId}/metrics/report-summary`);
    return res.json();
  },

  async createMetric(projectId: string, data: Partial<GrantMetric> & { presetKey?: string }): Promise<GrantMetric> {
    const res = await apiRequest("POST", `/api/projects/${projectId}/metrics`, data);
    return res.json();
  },

  async bulkCreateMetrics(
    projectId: string,
    suggestions: MetricSuggestion[],
    opts?: { status?: MetricStatus; source?: MetricSource },
  ): Promise<{ created: GrantMetric[] }> {
    const res = await apiRequest("POST", `/api/projects/${projectId}/metrics/bulk`, {
      suggestions,
      status: opts?.status ?? "active",
      source: opts?.source ?? "ai_suggested",
    });
    return res.json();
  },

  async updateMetric(id: string, updates: Partial<GrantMetric> & { note?: string }): Promise<GrantMetric> {
    const res = await apiRequest("PATCH", `/api/metrics/${id}`, updates);
    return res.json();
  },

  async acceptMetric(id: string): Promise<GrantMetric> {
    const res = await apiRequest("POST", `/api/metrics/${id}/accept`);
    return res.json();
  },

  async dismissMetric(id: string): Promise<GrantMetric> {
    const res = await apiRequest("POST", `/api/metrics/${id}/dismiss`);
    return res.json();
  },

  async deleteMetric(id: string): Promise<void> {
    await apiRequest("DELETE", `/api/metrics/${id}`);
  },

  async getMetricHistory(id: string): Promise<GrantMetricEvent[]> {
    const res = await apiRequest("GET", `/api/metrics/${id}/history`);
    return res.json();
  },

  async recordMetricEvent(
    id: string,
    data: RecordMetricEventPayload,
  ): Promise<RecordMetricEventResponse> {
    const res = await apiRequest("POST", `/api/metrics/${id}/events`, data);
    return res.json();
  },

  async getPortfolioMetrics(opts?: {
    periodStart?: string | null;
    periodEnd?: string | null;
    organizationId?: string | null;
  }): Promise<PortfolioMetricsResponse> {
    const params = new URLSearchParams();
    if (opts?.periodStart) params.set("periodStart", opts.periodStart);
    if (opts?.periodEnd) params.set("periodEnd", opts.periodEnd);
    const qs = params.toString();
    const path = opts?.organizationId
      ? `/api/organizations/${opts.organizationId}/metrics/portfolio`
      : "/api/metrics/portfolio";
    const res = await apiRequest("GET", `${path}${qs ? `?${qs}` : ""}`);
    return res.json();
  },

  async extractMetricsFromFile(projectId: string, file: File): Promise<{ suggestions: MetricSuggestion[] }> {
    const formData = new FormData();
    formData.append("file", file);

    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const url = API_BASE_URL
      ? `${API_BASE_URL}/api/projects/${projectId}/metrics/extract`
      : `/api/projects/${projectId}/metrics/extract`;

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
};
