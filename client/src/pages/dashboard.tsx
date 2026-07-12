import { useMemo, useState } from "react";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectCard, type ProjectQuestionCounts } from "@/components/ui/project-card";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { HomeGuidance } from "@/components/HomeGuidance";
import { api, type Project } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { isQuestionAnswered, resolveResponseStatus } from "@/lib/questions";
import { LAST_OPENED_PROJECT_STORAGE_KEY } from "@/lib/recent-project";
import { FolderOpen } from "lucide-react";
import { useCheckoutReturn } from "@/hooks/useCheckoutReturn";

interface DashboardProps {
  onOpenProject?: (projectId: string, tab?: string) => void;
  onNewProject?: () => void;
  onNavigateToDocuments?: () => void;
}

export default function Dashboard({ onOpenProject, onNewProject, onNavigateToDocuments }: DashboardProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useWorkspace();
  useCheckoutReturn(activeOrganizationId);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [lastOpenedProjectId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(LAST_OPENED_PROJECT_STORAGE_KEY)
  );

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: workspaceKeys.projects(activeOrganizationId),
    queryFn: () => activeOrganizationId ? api.getOrganizationProjects(activeOrganizationId) : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

  const {
    data: documents = [],
    isLoading: documentsLoading,
    isError: documentsErrored,
  } = useQuery({
    queryKey: workspaceKeys.documents(activeOrganizationId),
    queryFn: () =>
      activeOrganizationId ? api.getOrganizationDocuments(activeOrganizationId) : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

  // Real progress instead of the raw lifecycle status — a brand-new project
  // with zero questions shouldn't read as "Draft Review".
  const questionQueries = useQueries({
    queries: projects.map((project) => ({
      queryKey: workspaceKeys.projectQuestions(activeOrganizationId, project.id),
      queryFn: () => api.getQuestions(project.id),
      enabled: !!activeOrganizationId,
      staleTime: 60_000,
    })),
  });

  const questionCountsByProjectId = useMemo(() => {
    const map: Record<string, ProjectQuestionCounts> = {};
    projects.forEach((project, index) => {
      const result = questionQueries[index];
      const questions = result?.data ?? [];
      map[project.id] = {
        total: questions.length,
        answered: questions.filter((q) => isQuestionAnswered(resolveResponseStatus(q))).length,
        loading: result?.isLoading ?? false,
      };
    });
    return map;
  }, [projects, questionQueries]);

  // Home guidance reads completion booleans (hasDocuments, question counts)
  // straight from these queries' defaults — render it only once they've
  // settled successfully, so a returning workspace never flashes (or gets
  // permanently stuck showing) a "get set up" checklist for data that's
  // simply still loading or failed to load.
  const guidanceDataUnsettled =
    documentsLoading ||
    documentsErrored ||
    questionQueries.some((q) => q.isLoading || q.isError);

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.projects(activeOrganizationId) });
        queryClient.invalidateQueries({ queryKey: workspaceKeys.stats(activeOrganizationId) });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const handleEditProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setEditingProject(project);
      setIsEditDialogOpen(true);
    }
  };

  // Soonest deadline first; projects without a deadline sink to the bottom.
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  if (projectsLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-200 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!guidanceDataUnsettled && (
        <HomeGuidance
          projects={projects}
          questionCountsByProjectId={questionCountsByProjectId}
          hasDocuments={documents.length > 0}
          lastOpenedProjectId={lastOpenedProjectId}
          onOpenProject={(projectId, tab) => onOpenProject?.(projectId, tab)}
          onNavigateToDocuments={() => onNavigateToDocuments?.()}
          onNewProject={() => onNewProject?.()}
        />
      )}

      {sortedProjects.length === 0 ? (
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 md:p-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No applications yet</h3>
              <p className="text-slate-600">Create your first application above to get started.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              questionCounts={questionCountsByProjectId[project.id]}
              onDelete={handleDeleteProject}
              onEdit={handleEditProject}
              onOpen={onOpenProject}
            />
          ))}
        </div>
      )}

      {editingProject && (
        <EditProjectDialog
          project={editingProject}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          organizationId={activeOrganizationId}
        />
      )}
    </div>
  );
}
