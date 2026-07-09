import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { api, type Project } from "@/lib/api";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { isQuestionAnswered, resolveResponseStatus } from "@/lib/questions";
import { MetricsTab } from "./metrics";
import { QuestionsPanel } from "./QuestionsPanel";
import { DraftsPanel } from "./DraftsPanel";

interface ProjectDetailProps {
  onBack: () => void;
}

const VALID_TABS = ["overview", "metrics", "questions", "drafts"];

// Only terminal lifecycle states get a badge here — "draft" doesn't mean
// much on its own and is instead represented by the stage chips below.
const terminalStatusColors: Record<string, string> = {
  submitted: "bg-green-100 text-green-800",
  awarded: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-800",
};

export function ProjectDetail({ onBack }: ProjectDetailProps) {
  const { id: projectId, tab: tabParam } = useParams<{ id: string; tab?: string }>();
  const [, setLocation] = useLocation();
  const [editOpen, setEditOpen] = useState(false);
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "overview";
  const handleTabChange = (tab: string) => {
    setLocation(`/app/applications/${projectId}/${tab}`);
  };
  const { activeOrganizationId } = useWorkspace();

  // An unrecognized :tab segment (typo, stale link) would otherwise render
  // Overview while leaving the invalid URL in the address bar — normalize it
  // so refresh/bookmark/share always match what's on screen.
  useEffect(() => {
    if (tabParam && !VALID_TABS.includes(tabParam)) {
      setLocation(`/app/applications/${projectId}`, { replace: true });
    }
  }, [tabParam, projectId, setLocation]);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: () => api.getProject(projectId),
    enabled: Boolean(projectId),
  });

  const { data: questions = [] } = useQuery({
    queryKey: workspaceKeys.projectQuestions(project?.organizationId, projectId),
    queryFn: () => api.getQuestions(projectId),
    enabled: Boolean(project),
  });

  useEffect(() => {
    if (project && activeOrganizationId && project.organizationId !== activeOrganizationId) {
      onBack();
    }
  }, [activeOrganizationId, onBack, project]);

  const { totalCount, answeredCount } = useMemo(() => {
    return {
      totalCount: questions.length,
      answeredCount: questions.filter((q) => isQuestionAnswered(resolveResponseStatus(q))).length,
    };
  }, [questions]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded bg-slate-100" />
        <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (!project) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-slate-600">Project not found.</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            Back to dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const deadline = project.deadline ? new Date(project.deadline) : null;
  const terminalBadgeClass = terminalStatusColors[project.status];

  const stages = [
    { key: "setup", label: "Set up", done: true },
    {
      key: "questions",
      label: totalCount > 0 ? `Questions ${totalCount}` : "Questions",
      done: totalCount > 0,
    },
    {
      key: "drafts",
      label: totalCount > 0 ? `Drafts ${answeredCount}/${totalCount}` : "Drafts",
      done: totalCount > 0 && answeredCount >= totalCount,
    },
    { key: "review", label: "Review", done: project.status !== "draft" },
    {
      key: "export",
      label: "Export",
      done: project.status === "submitted" || project.status === "awarded" || project.status === "declined",
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 md:text-2xl">{project.title}</h2>
            {terminalBadgeClass && (
              <Badge className={terminalBadgeClass}>
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            {project.funder}
            {project.amount ? ` · ${project.amount}` : ""}
            {deadline
              ? ` · Due ${deadline.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit project
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {stages.map((stage, index) => (
          <div key={stage.key} className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                stage.done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
              }`}
            >
              {stage.done && <Check className="h-3 w-3" />}
              {stage.label}
            </span>
            {index < stages.length - 1 && <span className="text-slate-300">—</span>}
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="min-w-max">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="drafts">Drafts</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-3 md:p-6">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Description
                </p>
                <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">
                  {project.description || "No description provided."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Funder"
                  value={project.funder}
                />
                <Field
                  label="Amount"
                  value={project.amount || "—"}
                />
                <Field
                  label="Status"
                  value={project.status}
                />
                <Field
                  label="Deadline"
                  value={
                    deadline
                      ? deadline.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <MetricsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="questions" className="mt-4">
          <QuestionsPanel projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="drafts" className="mt-4">
          <DraftsPanel projectId={projectId} project={project} />
        </TabsContent>
      </Tabs>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        organizationId={project.organizationId}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-slate-900 mt-1">{value}</p>
    </div>
  );
}
