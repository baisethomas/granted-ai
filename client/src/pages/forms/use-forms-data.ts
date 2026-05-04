import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * Custom hook for managing forms data (projects, questions, settings)
 */
export function useFormsData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useWorkspace();

  const { data: projects = [] } = useQuery({
    queryKey: workspaceKeys.projects(activeOrganizationId),
    queryFn: () => activeOrganizationId ? api.getOrganizationProjects(activeOrganizationId) : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

  const { data: settings } = useQuery({
    queryKey: workspaceKeys.userSettings(),
    queryFn: api.getSettings,
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => {
      if (!activeOrganizationId) {
        throw new Error("Select a workspace before creating a project.");
      }
      return api.createOrganizationProject(activeOrganizationId, data);
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.projects(activeOrganizationId) });
      }
      toast({
        title: "Project created",
        description: "Your grant application project has been created.",
      });
      return project;
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create project",
        description: error.message || "Could not create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: any }) =>
      api.updateProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.projects(activeOrganizationId) });
      }
      toast({
        title: "Project updated",
        description: "Your project has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update project",
        description: error.message || "Could not update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: ({ projectId, question }: { projectId: string; question: any }) =>
      api.createQuestion(projectId, question),
    onSuccess: () => {
      toast({
        title: "Question added",
        description: "Question has been added to the project.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add question",
        description: error.message || "Could not add question. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    projects,
    settings,
    createProjectMutation,
    updateProjectMutation,
    createQuestionMutation,
  };
}
