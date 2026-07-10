import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Project } from "@/lib/api";
import { type ProjectQuestionCounts } from "@/components/ui/project-card";
import { computeUpNext, isDraftProject } from "@/lib/home-guidance";
import { Check, ArrowRight, FileUp, FileQuestion, Wand2, CheckCircle2 } from "lucide-react";

interface HomeGuidanceProps {
  projects: Project[];
  questionCountsByProjectId: Record<string, ProjectQuestionCounts>;
  hasDocuments: boolean;
  lastOpenedProjectId: string | null;
  onOpenProject: (projectId: string, tab?: string) => void;
  onNavigateToDocuments: () => void;
  onNewProject: () => void;
}

interface ChecklistStep {
  key: string;
  label: string;
  done: boolean;
  icon: typeof FileUp;
  action: () => void;
  actionLabel: string;
}

function byDeadlineSoonest(a: Project, b: Project) {
  if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return 0;
}

export function HomeGuidance({
  projects,
  questionCountsByProjectId,
  hasDocuments,
  lastOpenedProjectId,
  onOpenProject,
  onNavigateToDocuments,
  onNewProject,
}: HomeGuidanceProps) {
  const sortedProjects = [...projects].sort(byDeadlineSoonest);
  const hasAnyQuestion = sortedProjects.some((p) => (questionCountsByProjectId[p.id]?.total ?? 0) > 0);
  const hasAnyAnsweredQuestion = sortedProjects.some((p) => (questionCountsByProjectId[p.id]?.answered ?? 0) > 0);

  // Only draft-lifecycle projects are valid checklist targets — a submitted/
  // final/awarded/declined project shouldn't get the "add questions" or
  // "generate a draft" nudge. Falls back to "New application" (via the
  // action ternaries below) when no draft project exists.
  const draftLifecycleProjects = sortedProjects.filter(isDraftProject);
  const questionsTarget = draftLifecycleProjects[0];
  const draftsTarget =
    draftLifecycleProjects.find((p) => (questionCountsByProjectId[p.id]?.total ?? 0) > 0) ??
    draftLifecycleProjects[0];

  const steps: ChecklistStep[] = [
    {
      key: "documents",
      label: "Upload your source material",
      done: hasDocuments,
      icon: FileUp,
      action: onNavigateToDocuments,
      actionLabel: "Upload documents",
    },
    {
      key: "questions",
      label: "Add your grant questions",
      done: hasAnyQuestion,
      icon: FileQuestion,
      action: questionsTarget ? () => onOpenProject(questionsTarget.id, "questions") : onNewProject,
      actionLabel: questionsTarget ? "Add questions" : "New application",
    },
    {
      key: "draft",
      label: "Generate your first draft",
      done: hasAnyAnsweredQuestion,
      icon: Wand2,
      action: draftsTarget ? () => onOpenProject(draftsTarget.id, "drafts") : onNewProject,
      actionLabel: "Generate a draft",
    },
  ];

  const checklistComplete = steps.every((s) => s.done);
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  const lastOpenedProject = lastOpenedProjectId
    ? projects.find((p) => p.id === lastOpenedProjectId)
    : undefined;

  const upNext = checklistComplete ? computeUpNext(sortedProjects, questionCountsByProjectId, hasDocuments) : null;

  const showContinueRow =
    lastOpenedProject &&
    !(upNext?.kind === "action" && upNext.project.id === lastOpenedProject.id);

  return (
    <div className="space-y-3">
      {!checklistComplete && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Get set up</h3>
              <span className="text-xs font-medium text-slate-500">{doneCount} of {steps.length}</span>
            </div>
            <div className="space-y-2">
              {steps.map((step) => {
                const Icon = step.icon;
                const isNext = nextStep?.key === step.key;
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      step.done ? "bg-slate-50" : isNext ? "bg-[#EAF2FE]" : ""
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        step.done ? "bg-emerald-100 text-emerald-700" : "bg-white border border-slate-200 text-slate-400"
                      }`}
                    >
                      {step.done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className={`flex-1 text-sm ${step.done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                      {step.label}
                    </span>
                    {isNext && (
                      <Button size="sm" variant="ghost" onClick={step.action} className="h-7 px-2 text-xs">
                        {step.actionLabel}
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {upNext?.kind === "action" && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Up next</p>
              <p className="mt-1 text-sm text-slate-800">{upNext.message}</p>
            </div>
            <Button
              size="sm"
              className="w-full sm:w-auto shrink-0"
              onClick={() => onOpenProject(upNext.project.id, upNext.tab)}
            >
              {upNext.actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {upNext?.kind === "caught-up" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Nothing needs your attention right now.
        </div>
      )}

      {showContinueRow && lastOpenedProject && (
        <button
          type="button"
          onClick={() => onOpenProject(lastOpenedProject.id)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          <span className="truncate">
            Continue <span className="font-medium text-slate-900">{lastOpenedProject.title}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      )}
    </div>
  );
}
