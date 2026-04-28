import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";

/**
 * Custom hook for managing document uploads and queries
 */
export function useUploadData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeOrganizationId } = useWorkspace();

  const { data: documents = [], isLoading, error, refetch } = useQuery({
    queryKey: ["organizations", activeOrganizationId, "documents"],
    queryFn: () => activeOrganizationId ? api.getOrganizationDocuments(activeOrganizationId) : Promise.resolve([]),
    enabled: !!activeOrganizationId,
    staleTime: 30000, // 30 seconds
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) =>
      api.uploadDocument(file, category, { organizationId: activeOrganizationId ?? undefined }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ["organizations", activeOrganizationId, "documents"] });
      }
      toast({
        title: "Upload successful",
        description: `${data.filename} has been uploaded and is being processed.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => api.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (activeOrganizationId) {
        queryClient.invalidateQueries({ queryKey: ["organizations", activeOrganizationId, "documents"] });
      }
      toast({
        title: "Document deleted",
        description: "The document has been removed from your library.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    documents,
    isLoading,
    error,
    refetch,
    uploadDocument: uploadMutation.mutate,
    deleteDocument: deleteMutation.mutate,
    isUploading: uploadMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
