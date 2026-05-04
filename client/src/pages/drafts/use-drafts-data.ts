import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * Custom hook for managing drafts data fetching and mutations
 */
export function useDraftsData(selectedProject: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useWorkspace();

  const { data: projects = [] } = useQuery({
    queryKey: workspaceKeys.projects(activeOrganizationId),
    queryFn: () => activeOrganizationId ? api.getOrganizationProjects(activeOrganizationId) : Promise.resolve([]),
    enabled: !!activeOrganizationId,
  });

  const { data: questions = [] } = useQuery({
    queryKey: workspaceKeys.projectQuestions(activeOrganizationId, selectedProject),
    queryFn: () => selectedProject ? api.getQuestions(selectedProject) : Promise.resolve([]),
    enabled: !!selectedProject,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    structuralSharing: (oldData, newData) => {
      if (oldData && newData && Array.isArray(oldData) && Array.isArray(newData)) {
        const merged = newData.map((newQ: any) => {
          const oldQ = oldData.find((q: any) => q.id === newQ.id);
          if (oldQ?.response && !newQ.response) {
            return oldQ;
          }
          return newQ;
        });
        return merged;
      }
      return newData;
    },
  });

  const { data: userSettings } = useQuery({
    queryKey: workspaceKeys.userSettings(),
    queryFn: api.getSettings,
  });

  const generateResponseMutation = useMutation({
    mutationFn: ({ questionId, tone, emphasisAreas }: {
      questionId: string;
      tone: string;
      emphasisAreas: string[]
    }) => api.generateResponse(questionId, { tone, emphasisAreas }),
    onSuccess: async (data, variables) => {
      const responseText = data.response || data.content || '';
      const statusValue = data.responseStatus ||
                         (data.status === 'completed' ? 'complete' : data.status) || 'complete';

      const normalizedData = {
        response: responseText,
        responseStatus: statusValue,
        errorMessage: data.errorMessage,
        citations: data.citations || [],
        assumptions: data.assumptions || [],
      };

      queryClient.setQueryData(
        workspaceKeys.projectQuestions(activeOrganizationId, selectedProject),
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return [];

          const updated = oldData.map((q: any) => {
            if (q.id === variables.questionId) {
              return {
                ...q,
                response: normalizedData.response || q.response || '',
                responseStatus: normalizedData.responseStatus || 'complete',
                errorMessage: normalizedData.errorMessage,
                citations: normalizedData.citations,
                assumptions: normalizedData.assumptions,
              };
            }
            return q;
          });

          return [...updated];
        }
      );

      queryClient.cancelQueries({
        queryKey: workspaceKeys.projectQuestions(activeOrganizationId, selectedProject),
        exact: false
      });

      const status = normalizedData.responseStatus;
      if (status === "needs_context" || status === "failed" || status === "timeout") {
        toast({
          title: "Response generated with limitations",
          description: data.errorMessage || "The response was generated but may need additional context or refinement.",
          variant: "default",
        });
      } else {
        toast({
          title: "Response generated",
          description: "AI has generated a new response for your question.",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateResponseMutation = useMutation({
    mutationFn: ({ questionId, content }: { questionId: string; content: string }) =>
      api.updateResponse(questionId, content, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projectQuestions(activeOrganizationId, selectedProject) });
      toast({
        title: "Response updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const finalizeProjectMutation = useMutation({
    mutationFn: (projectId: string) => api.finalizeProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.projects(activeOrganizationId) });
      }
      toast({
        title: "Project finalized",
        description: "Your project has been marked as final and is ready for submission.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Finalization failed",
        description: error.message || "Failed to finalize project. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    projects,
    questions,
    userSettings,
    generateResponseMutation,
    updateResponseMutation,
    finalizeProjectMutation,
  };
}
