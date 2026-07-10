import { type Project } from "@/lib/api";
import { type ProjectQuestionCounts } from "@/components/ui/project-card";

export type UpNextResult =
  | { kind: "action"; message: string; actionLabel: string; project: Project; tab: string }
  | { kind: "caught-up" }
  | null;

export function computeUpNext(
  sortedProjects: Project[],
  questionCountsByProjectId: Record<string, ProjectQuestionCounts>,
  hasDocuments: boolean,
): UpNextResult {
  if (!hasDocuments) return null; // checklist covers this; avoid saying it twice

  const needsQuestions = sortedProjects.find((p) => (questionCountsByProjectId[p.id]?.total ?? 0) === 0);
  if (needsQuestions) {
    return {
      kind: "action",
      message: `${needsQuestions.title} doesn't have any questions yet.`,
      actionLabel: "Add questions",
      project: needsQuestions,
      tab: "questions",
    };
  }

  const needsAnswers = sortedProjects.find((p) => {
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

  const readyToReview = sortedProjects.find((p) => {
    const c = questionCountsByProjectId[p.id];
    return c && c.total > 0 && c.answered >= c.total && p.status === "draft";
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
