import { describe, expect, it } from "vitest";
import { computeChecklistProgress, computeUpNext } from "./home-guidance";
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

describe("computeChecklistProgress", () => {
  it("treats a brand-new workspace (no projects) as needing setup, with no target", () => {
    const result = computeChecklistProgress([], {});
    expect(result).toEqual({
      hasAnyQuestion: false,
      hasAnyAnsweredQuestion: false,
      questionsTarget: undefined,
      draftsTarget: undefined,
    });
  });

  it("points at the draft project when one exists and needs questions", () => {
    const draft = makeProject({ id: "p1", title: "Active Grant", status: "draft" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
    };
    const result = computeChecklistProgress([draft], counts);
    expect(result.hasAnyQuestion).toBe(false);
    expect(result.questionsTarget).toBe(draft);
    expect(result.draftsTarget).toBe(draft);
  });

  it("marks both steps satisfied when the only project is terminal with no question history", () => {
    // A project marked submitted/final/awarded/declined with zero questions
    // ever added shouldn't leave the checklist permanently stuck — there's
    // no draft project left to point the "add questions"/"generate a draft"
    // actions at, so computeUpNext should get a chance to report caught-up.
    const submitted = makeProject({ id: "p1", title: "Submitted Grant", status: "submitted" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
    };
    const result = computeChecklistProgress([submitted], counts);
    expect(result.hasAnyQuestion).toBe(true);
    expect(result.hasAnyAnsweredQuestion).toBe(true);
    expect(result.questionsTarget).toBeUndefined();
    expect(result.draftsTarget).toBeUndefined();
  });

  it("still reports incomplete when a draft project coexists with a terminal one that has no history", () => {
    const submitted = makeProject({ id: "p1", title: "Submitted Grant", status: "submitted" });
    const draft = makeProject({ id: "p2", title: "Active Grant", status: "draft" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
      p2: { total: 0, answered: 0, loading: false },
    };
    const result = computeChecklistProgress([submitted, draft], counts);
    expect(result.hasAnyQuestion).toBe(false);
    expect(result.questionsTarget).toBe(draft);
  });

  it("still credits history from a terminal project once it has questions answered", () => {
    // The checklist is an ever-done-this-before milestone, not a per-project
    // tracker — a finalized project's own history should still satisfy it.
    const finalized = makeProject({ id: "p1", title: "Finalized Grant", status: "final" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 2, answered: 2, loading: false },
    };
    const result = computeChecklistProgress([finalized], counts);
    expect(result.hasAnyQuestion).toBe(true);
    expect(result.hasAnyAnsweredQuestion).toBe(true);
  });

  it("prefers a draft project needing questions as the draftsTarget fallback", () => {
    const draftNoQuestions = makeProject({ id: "p1", title: "Empty Draft", status: "draft" });
    const draftWithQuestions = makeProject({ id: "p2", title: "Started Draft", status: "draft" });
    const counts: Record<string, ProjectQuestionCounts> = {
      p1: { total: 0, answered: 0, loading: false },
      p2: { total: 2, answered: 0, loading: false },
    };
    const result = computeChecklistProgress([draftNoQuestions, draftWithQuestions], counts);
    expect(result.questionsTarget).toBe(draftNoQuestions);
    expect(result.draftsTarget).toBe(draftWithQuestions);
  });
});
