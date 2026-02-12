import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

/**
 * Custom hook for managing forms data (projects, questions, settings)
 */
export function useFormsData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: api.getProjects,
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: api.getSettings,
  });

  const createProjectMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
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
