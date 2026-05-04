import { describe, expect, it } from "vitest";
import { workspaceKeys } from "./workspace-query-keys";

describe("workspace query keys", () => {
  it("includes the organization id for workspace-scoped project, document, stats, and portfolio caches", () => {
    expect(workspaceKeys.projects("org-a")).toEqual(["organizations", "org-a", "projects"]);
    expect(workspaceKeys.documents("org-a")).toEqual(["organizations", "org-a", "documents"]);
    expect(workspaceKeys.stats("org-a")).toEqual(["organizations", "org-a", "stats"]);
    expect(workspaceKeys.portfolioMetrics("org-a", "2026-01-01", "2026-03-31")).toEqual([
      "organizations",
      "org-a",
      "metrics",
      "portfolio",
      "2026-01-01",
      "2026-03-31",
    ]);
  });

  it("includes the organization id in project child caches to prevent stale selected-project data after switching workspaces", () => {
    expect(workspaceKeys.projectQuestions("org-a", "project-1")).toEqual([
      "organizations",
      "org-a",
      "projects",
      "project-1",
      "questions",
    ]);
    expect(workspaceKeys.projectMetrics("org-a", "project-1")).toEqual([
      "organizations",
      "org-a",
      "projects",
      "project-1",
      "metrics",
    ]);
  });

  it("keeps user-level settings outside workspace-scoped cache keys", () => {
    expect(workspaceKeys.userSettings()).toEqual(["/api/settings"]);
  });
});
