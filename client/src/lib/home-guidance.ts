import { type Project } from "@/lib/api";
import { type ProjectQuestionCounts } from "@/components/ui/project-card";

export type UpNextResult =
  | { kind: "action"; message: string; actionLabel: string; project: Project; tab: string }
  | { kind: "caught-up" }
  | null;

// Once a project leaves the draft lifecycle (finalized, or manually marked
// submitted/awarded/declined via the edit dialog), it's done — nothing in
// the home guidance should point the user back at it for more setup work.
export function isDraftProject(project: Project): boolean {
  return project.status === "draft";
}

export interface ChecklistProgress {
  hasAnyQuestion: boolean;
  hasAnyAnsweredQuestion: boolean;
  questionsTarget: Project | undefined;
  draftsTarget: Project | undefined;
}

export function computeChecklistProgress(
  sortedProjects: Project[],
  questionCountsByProjectId: Record<string, ProjectQuestionCounts>,
): ChecklistProgress {
  const draftLifecycleProjects = sortedProjects.filter(isDraftProject);
  const questionsTarget = draftLifecycleProjects[0];
  const draftsTarget =
    draftLifecycleProjects.find((p) => (questionCountsByProjectId[p.id]?.total ?? 0) > 0) ??
    draftLifecycleProjects[0];

  // If projects exist but none remain in the draft lifecycle, there's no
  // more setup work possible for these two steps — treat them as satisfied
  // so checklistComplete can hand off to computeUpNext, which correctly
  // reports "caught up" instead of nagging forever with no real target.
  const noDraftProjectsToSetUp = sortedProjects.length > 0 && draftLifecycleProjects.length === 0;
  const hasAnyQuestion =
    noDraftProjectsToSetUp || sortedProjects.some((p) => (questionCountsByProjectId[p.id]?.total ?? 0) > 0);
  const hasAnyAnsweredQuestion =
    noDraftProjectsToSetUp || sortedProjects.some((p) => (questionCountsByProjectId[p.id]?.answered ?? 0) > 0);

  return { hasAnyQuestion, hasAnyAnsweredQuestion, questionsTarget, draftsTarget };
}

export function computeUpNext(
  sortedProjects: Project[],
  questionCountsByProjectId: Record<string, ProjectQuestionCounts>,
  hasDocuments: boolean,
): UpNextResult {
  if (!hasDocuments) return null; // checklist covers this; avoid saying it twice

  const draftProjects = sortedProjects.filter(isDraftProject);

  const needsQuestions = draftProjects.find((p) => (questionCountsByProjectId[p.id]?.total ?? 0) === 0);
  if (needsQuestions) {
    return {
      kind: "action",
      message: `${needsQuestions.title} doesn't have any questions yet.`,
      actionLabel: "Add questions",
      project: needsQuestions,
      tab: "questions",
    };
  }

  const needsAnswers = draftProjects.find((p) => {
    const c = questionCountsByProjectId[p.id];
    return c && c.total > 0 && c.answered < c.total;
  });
  if (needsAnswers) {
    const c = questionCountsByProjectId[needsAnswers.id];
    const remaining = c.total - c.answered;
    return {
      kind: "action",
      message: `${needsAnswers.title} has ${remaining} question${remaining === 1 ? "" : "s"} left to draft.`,
      actionLabel: "Generate drafts",
      project: needsAnswers,
      tab: "drafts",
    };
  }

  const readyToReview = draftProjects.find((p) => {
    const c = questionCountsByProjectId[p.id];
    return c && c.total > 0 && c.answered >= c.total;
  });
  if (readyToReview) {
    return {
      kind: "action",
      message: `${readyToReview.title} is fully drafted and ready to review.`,
      actionLabel: "Review and export",
      project: readyToReview,
      tab: "drafts",
    };
  }

  if (sortedProjects.length > 0) return { kind: "caught-up" };
  return null;
}
