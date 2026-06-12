import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/ui/project-card";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { api, type Project } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { FolderOpen, Plus } from "lucide-react";

interface DashboardProps {
  onOpenProject?: (projectId: string) => void;
}

export default function Dashboard({ onOpenProject }: DashboardProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganization, activeOrganizationId } = useWorkspace();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: workspaceKeys.projects(activeOrganizationId),
    queryFn: () => activeOrganizationId ? api.getOrganizationProjects(activeOrganizationId) : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 md:text-2xl">
            {activeOrganization?.name || "Select a client workspace"}
          </h2>
          <p className="text-slate-600 mt-1">Your grant applications, soonest deadline first.</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setIsNewProjectDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Grant Application
        </Button>
      </div>

      {sortedProjects.length === 0 ? (
        <Card className="shadow-sm border border-slate-200">
          <CardContent className="p-4 md:p-6">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Start your first grant application</h3>
              <p className="text-slate-600 mb-4">
                Create a project, add your grant questions, and Granted will draft answers from your documents.
              </p>
              <Button onClick={() => setIsNewProjectDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDeleteProject}
              onEdit={handleEditProject}
              onOpen={onOpenProject}
            />
          ))}
        </div>
      )}

      <NewProjectDialog
        open={isNewProjectDialogOpen}
        onOpenChange={setIsNewProjectDialogOpen}
        organizationId={activeOrganizationId}
        organizationName={activeOrganization?.name}
      />

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
