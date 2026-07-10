import { describe, expect, it } from "vitest";
import { computeUpNext } from "./home-guidance";
import { type Project } from "@/lib/api";
import { type ProjectQuestionCounts } from "@/components/ui/project-card";

function makeProject(overrides: Partial<Project> & { id: string; title: string }): Project {
  return {
    organizationId: "org-1",
    funder: "Test Funder",
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("computeUpNext", () => {
  it("returns null when there are no documents yet, deferring to the setup checklist", () => {
    const projects = [makeProject({ id: "p1", title: "Alpha Grant" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
    };
    expect(computeUpNext(projects, counts, false)).toBeNull();
  });

  it("returns null when there are no projects at all", () => {
    expect(computeUpNext([], {}, true)).toBeNull();
  });

  it("surfaces a project with zero questions before anything else", () => {
    const projects = [makeProject({ id: "p1", title: "Alpha Grant" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
    };
    const result = computeUpNext(projects, counts, true);
    expect(result).toEqual({
      kind: "action",
      message: "Alpha Grant doesn't have any questions yet.",
      actionLabel: "Add questions",
      project: projects[0],
      tab: "questions",
    });
  });

  it("surfaces a project with unanswered questions, pluralizing correctly", () => {
    const projects = [makeProject({ id: "p1", title: "Alpha Grant" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 3, answered: 1, loading: false },
    };
    const result = computeUpNext(projects, counts, true);
    expect(result).toMatchObject({
      kind: "action",
      message: "Alpha Grant has 2 questions left to draft.",
      actionLabel: "Generate drafts",
      tab: "drafts",
    });
  });

  it("uses singular phrasing when exactly one question is left", () => {
    const projects = [makeProject({ id: "p1", title: "Alpha Grant" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 3, answered: 2, loading: false },
    };
    const result = computeUpNext(projects, counts, true);
    expect(result).toMatchObject({ message: "Alpha Grant has 1 question left to draft." });
  });

  it("surfaces a fully-answered draft project as ready to review", () => {
    const projects = [makeProject({ id: "p1", title: "Alpha Grant", status: "draft" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 2, answered: 2, loading: false },
    };
    const result = computeUpNext(projects, counts, true);
    expect(result).toMatchObject({
      kind: "action",
      message: "Alpha Grant is fully drafted and ready to review.",
      actionLabel: "Review and export",
      tab: "drafts",
    });
  });

  it("reports caught-up once every project is finalized", () => {
    const projects = [makeProject({ id: "p1", title: "Alpha Grant", status: "final" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 2, answered: 2, loading: false },
    };
    expect(computeUpNext(projects, counts, true)).toEqual({ kind: "caught-up" });
  });

  it("prioritizes needs-questions over a different project that's ready to review", () => {
    const readyProject = makeProject({ id: "p1", title: "Ready Grant", status: "draft" });
    const emptyProject = makeProject({ id: "p2", title: "Empty Grant" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 2, answered: 2, loading: false },
      p2: { total: 0, answered: 0, loading: false },
    };
    const result = computeUpNext([readyProject, emptyProject], counts, true);
    expect(result).toMatchObject({ message: "Empty Grant doesn't have any questions yet." });
  });

  it("prioritizes needs-answers over a different project that's ready to review", () => {
    const readyProject = makeProject({ id: "p1", title: "Ready Grant", status: "draft" });
    const partialProject = makeProject({ id: "p2", title: "Partial Grant" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 2, answered: 2, loading: false },
      p2: { total: 2, answered: 1, loading: false },
    };
    const result = computeUpNext([readyProject, partialProject], counts, true);
    expect(result).toMatchObject({ message: "Partial Grant has 1 question left to draft." });
  });

  it("is only caught-up once every project is past the draft stage", () => {
    const finalProject = makeProject({ id: "p1", title: "Done Grant", status: "final" });
    const readyProject = makeProject({ id: "p2", title: "Ready Grant", status: "draft" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 2, answered: 2, loading: false },
      p2: { total: 2, answered: 2, loading: false },
    };
    const result = computeUpNext([finalProject, readyProject], counts, true);
    expect(result).toMatchObject({ message: "Ready Grant is fully drafted and ready to review." });
  });

  it("never nudges to add questions on a project marked submitted with zero questions", () => {
    const projects = [makeProject({ id: "p1", title: "Submitted Grant", status: "submitted" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
    };
    expect(computeUpNext(projects, counts, true)).toEqual({ kind: "caught-up" });
  });

  it("never nudges to keep drafting a finalized project with unanswered questions", () => {
    const projects = [makeProject({ id: "p1", title: "Finalized Grant", status: "final" })];
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 3, answered: 1, loading: false },
    };
    expect(computeUpNext(projects, counts, true)).toEqual({ kind: "caught-up" });
  });

  it("never nudges an awarded or declined project with unanswered questions", () => {
    const awarded = makeProject({ id: "p1", title: "Awarded Grant", status: "awarded" });
    const declined = makeProject({ id: "p2", title: "Declined Grant", status: "declined" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 3, answered: 0, loading: false },
      p2: { total: 3, answered: 1, loading: false },
    };
    expect(computeUpNext([awarded, declined], counts, true)).toEqual({ kind: "caught-up" });
  });

  it("skips a submitted project with zero questions in favor of a draft project that needs them", () => {
    const submitted = makeProject({ id: "p1", title: "Submitted Grant", status: "submitted" });
    const draft = makeProject({ id: "p2", title: "Active Grant", status: "draft" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
      p2: { total: 0, answered: 0, loading: false },
    };
    const result = computeUpNext([submitted, draft], counts, true);
    expect(result).toMatchObject({ message: "Active Grant doesn't have any questions yet." });
  });
});
