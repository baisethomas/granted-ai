export const workspaceKeys = {
  userSettings: () => ["/api/settings"] as const,
  organization: (organizationId: string | null | undefined) =>
    ["organizations", organizationId] as const,
  projects: (organizationId: string | null | undefined) =>
    ["organizations", organizationId, "projects"] as const,
  documents: (organizationId: string | null | undefined) =>
    ["organizations", organizationId, "documents"] as const,
  profileSuggestions: (organizationId: string | null | undefined) =>
    ["organizations", organizationId, "profile-suggestions"] as const,
  stats: (organizationId: string | null | undefined) =>
    ["organizations", organizationId, "stats"] as const,
  portfolioMetrics: (
    organizationId: string | null | undefined,
    periodStart: string,
    periodEnd: string,
  ) => ["organizations", organizationId, "metrics", "portfolio", periodStart, periodEnd] as const,
  projectQuestions: (
    organizationId: string | null | undefined,
    projectId: string | null | undefined,
  ) => ["organizations", organizationId, "projects", projectId, "questions"] as const,
  projectMetrics: (
    organizationId: string | null | undefined,
    projectId: string | null | undefined,
  ) => ["organizations", organizationId, "projects", projectId, "metrics"] as const,
  metricHistory: (metricId: string) => ["metric-history", metricId] as const,
};
