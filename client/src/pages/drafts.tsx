import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  exportToClipboard, 
  exportToPDF, 
  exportToWord, 
  validateExportData 
} from "@/lib/export";
import { 
  RotateCcw, 
  Copy, 
  FileText, 
  Download,
  Edit,
  Check,
  Clock,
  Lightbulb,
  Eye,
  MoreHorizontal,
  Save,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Target,
  BookOpen,
  Wand2
} from "lucide-react";
import CitationTooltip from "@/components/CitationTooltip";
import EvidenceMap, { EvidenceMapData } from "@/components/EvidenceMap";

// Helper function to normalize question data (handles both camelCase and snake_case)
function normalizeQuestion(question: any) {
  return {
    ...question,
    response: question.response || question.response_text || '',
    responseStatus: question.responseStatus || question.response_status || 'pending',
  };
}

export default function Drafts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProject, setSelectedProject] = useState<string>("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [wordCount, setWordCount] = useState<number>(0);
  const [exportingPDF, setExportingPDF] = useState<boolean>(false);
  const [exportingWord, setExportingWord] = useState<boolean>(false);
  const [exportingClipboard, setExportingClipboard] = useState<boolean>(false);
  const [finalizingProject, setFinalizingProject] = useState<boolean>(false);
  const [showEvidenceMap, setShowEvidenceMap] = useState<boolean>(false);
  const [evidenceMapData, setEvidenceMapData] = useState<EvidenceMapData[]>([]);
  const [generatingQuestionId, setGeneratingQuestionId] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: api.getProjects,
  });

  const { data: questions = [] } = useQuery({
    queryKey: ["/api/projects", selectedProject, "questions"],
    queryFn: () => selectedProject ? api.getQuestions(selectedProject) : Promise.resolve([]),
    enabled: !!selectedProject,
  });

  const { data: userSettings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: api.getSettings,
  });

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: api.me,
  });

  const generateResponseMutation = useMutation({
    mutationFn: ({ questionId, tone, emphasisAreas }: { 
      questionId: string; 
      tone: string; 
      emphasisAreas: string[] 
    }) => api.generateResponse(questionId, { tone, emphasisAreas }),
    onMutate: ({ questionId }) => {
      // Set the question ID being generated
      setGeneratingQuestionId(questionId);
    },
    onSuccess: async (data, variables) => {
      setGeneratingQuestionId(null);
      
      // CRITICAL DEBUG: Log the raw data structure first
      console.log("🔍 RAW API DATA:", data);
      console.log("🔍 Data type:", typeof data);
      console.log("🔍 Data keys:", Object.keys(data || {}));
      console.log("🔍 data.content:", data.content);
      console.log("🔍 data.response:", data.response);
      console.log("🔍 data.status:", data.status);
      console.log("🔍 data.responseStatus:", data.responseStatus);
      
      // Normalize the response data - handle both snake_case and camelCase, and different response structures
      // The API might return 'content' instead of 'response', and 'status' instead of 'responseStatus'
      // IMPORTANT: Check data.content FIRST since that's what the mock API returns
      const responseText = data.response || data.content || (data as any).response_text || (data as any).response || '';
      const statusValue = data.responseStatus || (data as any).response_status || 
                         (data.status === 'completed' ? 'complete' : 
                          data.status === 'complete' ? 'complete' : 
                          data.status) || 'complete';
      
      console.log("🔍 Extracted responseText:", responseText?.substring(0, 100) || "EMPTY");
      console.log("🔍 Extracted statusValue:", statusValue);
      
      const normalizedData = {
        response: responseText,
        responseStatus: statusValue,
        errorMessage: data.errorMessage || (data as any).error_message || data.errorMessage,
        citations: data.citations || [],
        assumptions: data.assumptions || [],
      };
      
      console.log("🔍 Normalized Data:", normalizedData);
      
      // Immediate validation log
      if (!normalizedData.response && (data.content || data.response)) {
        console.error("❌ NORMALIZATION FAILED!", {
          dataContent: data.content,
          dataResponse: data.response,
          normalizedResponse: normalizedData.response,
          allDataKeys: Object.keys(data)
        });
      }
      
      // Debug: Log the response data with full details
      console.log("=== RESPONSE GENERATION SUCCESS ===");
      console.log("Question ID:", variables.questionId);
      console.log("Raw API Response:", JSON.stringify(data, null, 2));
      console.log("Data Keys:", Object.keys(data));
      console.log("Normalized Response:", normalizedData.response?.substring(0, 200) || "NO RESPONSE");
      console.log("Normalized Status:", normalizedData.responseStatus);
      console.log("Has Response:", !!normalizedData.response);
      console.log("Response Length:", normalizedData.response?.length || 0);
      console.log("Full Normalized Data:", normalizedData);
      
      // Optimistically update the cache with the returned response data
      queryClient.setQueryData(
        ["/api/projects", selectedProject, "questions"],
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return oldData;
          
          const updated = oldData.map((q: any) => {
            if (q.id === variables.questionId) {
              // Use normalized data, ensuring we have response and responseStatus
              const updatedQuestion = {
                ...q,
                response: normalizedData.response || q.response || (q as any).response_text || '',
                responseStatus: normalizedData.responseStatus || q.responseStatus || (q as any).response_status || 'complete',
                errorMessage: normalizedData.errorMessage || q.errorMessage || (q as any).error_message,
                citations: normalizedData.citations || q.citations || [],
                assumptions: normalizedData.assumptions || q.assumptions || [],
              };
              
              console.log("Cache update - Before:", {
                id: q.id,
                hasResponse: !!q.response,
                responseStatus: q.responseStatus || (q as any).response_status
              });
              
              console.log("Cache update - After:", {
                id: updatedQuestion.id,
                hasResponse: !!updatedQuestion.response,
                responseStatus: updatedQuestion.responseStatus,
                responsePreview: updatedQuestion.response?.substring(0, 100)
              });
              
              return updatedQuestion;
            }
            return q;
          });
          
          const updatedQuestion = updated.find((q: any) => q.id === variables.questionId);
          console.log("=== CACHE UPDATE ===");
          console.log("Question ID:", variables.questionId);
          console.log("Updated Question:", JSON.stringify(updatedQuestion, null, 2));
          console.log("Has Response:", !!updatedQuestion?.response);
          console.log("Response Status:", updatedQuestion?.responseStatus || updatedQuestion?.response_status);
          console.log("Response Preview:", updatedQuestion?.response?.substring(0, 200) || "NO RESPONSE");
          console.log("All Question Fields:", Object.keys(updatedQuestion || {}));
          
          // Force React Query to recognize this as new data by creating a new array reference
          const newArray = [...updated];
          console.log("✅ Returning new array with", newArray.length, "questions");
          
          return newArray;
        }
      );
      
      // Don't refetch immediately - the optimistic update should be enough
      // The refetch was overwriting our optimistic update with stale server data
      // Instead, invalidate the query so it will refetch on next mount or when needed
      queryClient.invalidateQueries({ 
        queryKey: ["/api/projects", selectedProject, "questions"],
        exact: false 
      });
      
      // Check if there are warnings or issues
      const status = normalizedData.responseStatus || (data as any).response_status;
      if (status === "needs_context" || status === "failed" || status === "timeout") {
        toast({
          title: "Response generated with limitations",
          description: data.errorMessage || "The response was generated but may need additional context or refinement.",
          variant: "default",
        });
      } else if (data.warning) {
        toast({
          title: "Response generated",
          description: data.warning,
          variant: "default",
        });
      } else {
        toast({
          title: "Response generated",
          description: "AI has generated a new response for your question.",
        });
      }
    },
    onError: (error: any, variables) => {
      console.error("Response generation error:", error);
      setGeneratingQuestionId(null);
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject, "questions"] });
      setHasUnsavedChanges(false);
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

  const handleRegenerateResponse = (questionId: string) => {
    // Get user settings for tone and emphasis areas, or use defaults
    const tone = userSettings?.defaultTone || "professional";
    const emphasisAreas = userSettings?.emphasisAreas || ["Impact & Outcomes", "Innovation"];
    
    generateResponseMutation.mutate({
      questionId,
      tone,
      emphasisAreas
    });
  };

  const handleFinalizeProject = async () => {
    if (!selectedProject || hasUnsavedChanges) return;

    const confirmFinalize = window.confirm(
      "Are you sure you want to finalize this project? This will mark it as complete and ready for submission."
    );
    
    if (!confirmFinalize) return;

    try {
      setFinalizingProject(true);
      await finalizeProjectMutation.mutateAsync(selectedProject);
    } catch (error) {
      // Error handling is done in the mutation
    } finally {
      setFinalizingProject(false);
    }
  };

  // Calculate word count
  const calculateWordCount = useCallback((text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  // Auto-save functionality
  const handleAutoSave = useCallback(async () => {
    if (editingQuestionId && editedContent !== originalContent && editedContent.trim()) {
      try {
        await updateResponseMutation.mutateAsync({
          questionId: editingQuestionId,
          content: editedContent
        });
        setHasUnsavedChanges(false); // Mark as saved
      } catch (error) {
        // Error handling is done in the mutation's onError
        console.error("Auto-save failed:", error);
      }
    }
  }, [editingQuestionId, editedContent, originalContent, updateResponseMutation]);

  // Auto-save with debouncing
  useEffect(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Only auto-save if there are actual changes and content is not empty
    if (hasUnsavedChanges && editedContent !== originalContent && editedContent.trim().length > 0) {
      const timeoutId = setTimeout(() => {
        handleAutoSave();
      }, 3000); // Increased to 3 seconds to reduce frequency

      setAutoSaveTimeout(timeoutId);
    }

    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [editedContent, originalContent, hasUnsavedChanges]); // Removed handleAutoSave from deps

  // This useEffect will be moved after function definitions

  // Update word count when content changes
  useEffect(() => {
    if (editedContent !== undefined) {
      setWordCount(calculateWordCount(editedContent));
    }
  }, [editedContent, calculateWordCount]);

  // Start editing mode
  const startEditing = (questionId: string, currentContent: string) => {
    if (editingQuestionId && hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Do you want to discard them and start editing this response?"
      );
      if (!confirmDiscard) return;
    }

    setEditingQuestionId(questionId);
    setEditedContent(currentContent || "");
    setOriginalContent(currentContent || "");
    setHasUnsavedChanges(false);
  };

  // Handle content changes
  const handleContentChange = (content: string) => {
    setEditedContent(content);
    setHasUnsavedChanges(content !== originalContent);
  };

  // Save changes manually
  const handleSave = async () => {
    if (!editingQuestionId || !hasUnsavedChanges) return;

    try {
      await updateResponseMutation.mutateAsync({
        questionId: editingQuestionId,
        content: editedContent
      });
      setEditingQuestionId(null);
      setEditedContent("");
      setOriginalContent("");
    } catch (error) {
      // Error handling is done in the mutation's onError
    }
  };

  // Cancel editing
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmDiscard = window.confirm(
        "You have unsaved changes. Do you want to discard them?"
      );
      if (!confirmDiscard) return;
    }

    setEditingQuestionId(null);
    setEditedContent("");
    setOriginalContent("");
    setHasUnsavedChanges(false);
  };

  // Keyboard shortcuts - moved after function definitions
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (editingQuestionId && (event.ctrlKey || event.metaKey)) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            if (hasUnsavedChanges) {
              handleSave();
            }
            break;
          case 'Escape':
            event.preventDefault();
            handleCancel();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [editingQuestionId, hasUnsavedChanges, handleSave, handleCancel]);

  const prepareExportData = () => {
    if (!selectedProjectData) {
      throw new Error("No project selected");
    }

    return {
      project: selectedProjectData,
      questions: questions,
      metadata: {
        exportDate: new Date(),
        organizationName: user?.organizationName
      }
    };
  };

  const handleCopyToClipboard = async () => {
    try {
      setExportingClipboard(true);
      const exportData = prepareExportData();
      
      const validation = validateExportData(exportData);
      if (!validation.valid) {
        toast({
          title: "Export failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      await exportToClipboard(exportData);
      
      toast({
        title: "Copied to clipboard",
        description: "All completed responses have been copied with professional formatting.",
      });
    } catch (error: any) {
      toast({
        title: "Copy failed",
        description: error.message || "Failed to copy to clipboard. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingClipboard(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExportingPDF(true);
      const exportData = prepareExportData();
      
      const validation = validateExportData(exportData);
      if (!validation.valid) {
        toast({
          title: "Export failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Export started",
        description: "Generating PDF... This may take a moment.",
      });

      await exportToPDF(exportData);
      
      toast({
        title: "PDF exported successfully",
        description: "Your grant application has been downloaded as a PDF.",
      });
    } catch (error: any) {
      toast({
        title: "PDF export failed",
        description: error.message || "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportWord = async () => {
    try {
      setExportingWord(true);
      const exportData = prepareExportData();
      
      const validation = validateExportData(exportData);
      if (!validation.valid) {
        toast({
          title: "Export failed",
          description: validation.errors.join(", "),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Export started",
        description: "Generating Word document... This may take a moment.",
      });

      await exportToWord(exportData);
      
      toast({
        title: "Word document exported successfully",
        description: "Your grant application has been downloaded as a DOCX file.",
      });
    } catch (error: any) {
      toast({
        title: "Word export failed",
        description: error.message || "Failed to generate Word document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExportingWord(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "bg-green-100 text-green-800";
      case "edited": return "bg-blue-100 text-blue-800";
      case "generating": return "bg-yellow-100 text-yellow-800";
      case "pending": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "final": return "bg-purple-100 text-purple-800 border-purple-200";
      case "draft": return "bg-orange-100 text-orange-800 border-orange-200";
      case "submitted": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete": return <Check className="mr-1 h-3 w-3" />;
      case "edited": return <Edit className="mr-1 h-3 w-3" />;
      case "generating": return <Clock className="mr-1 h-3 w-3" />;
      default: return <Clock className="mr-1 h-3 w-3" />;
    }
  };

  const getProjectStatusIcon = (status: string) => {
    switch (status) {
      case "final": return <CheckCircle2 className="mr-1 h-3 w-3" />;
      case "draft": return <Edit className="mr-1 h-3 w-3" />;
      case "submitted": return <Check className="mr-1 h-3 w-3" />;
      default: return <Clock className="mr-1 h-3 w-3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "complete": return "Complete";
      case "edited": return "Edited";
      case "generating": return "Generating";
      case "pending": return "Pending";
      default: return status;
    }
  };

  const getProjectStatusLabel = (status: string) => {
    switch (status) {
      case "final": return "Final";
      case "draft": return "Draft";
      case "submitted": return "Submitted";
      default: return status;
    }
  };

  const selectedProjectData = projects.find((p: any) => p.id === selectedProject);
  const completedQuestions = questions.filter((q: any) => {
    const normalized = normalizeQuestion(q);
    return normalized.responseStatus === "complete" || normalized.responseStatus === "edited";
  });
  const totalQuestions = questions.length;
  const progressPercentage = totalQuestions > 0 ? (completedQuestions.length / totalQuestions) * 100 : 0;

  // Generate mock evidence map data based on completed questions
  const generateEvidenceMapData = (): EvidenceMapData[] => {
    return completedQuestions.map((question: any, index: number) => ({
      sectionName: `Question ${index + 1}`,
      evidenceStrength: Math.random() * 0.3 + 0.7, // Random between 0.7-1.0 for demo
      sourceCount: Math.floor(Math.random() * 4) + 1,
      assumptionCount: Math.floor(Math.random() * 2),
      qualityIssues: [],
      recommendations: [
        "Consider adding specific metrics to strengthen this claim",
        "Include additional source documentation"
      ].slice(0, Math.floor(Math.random() * 2) + 1),
      paragraphs: [
        {
          id: `p-${question.id}-1`,
          text: question.response?.substring(0, 200) + '...' || '',
          citationCount: Math.floor(Math.random() * 3) + 1,
          assumptionCount: Math.floor(Math.random() * 2),
          evidenceScore: Math.random() * 0.3 + 0.7
        }
      ]
    }));
  };

  // Calculate overall grounding quality
  const calculateOverallGroundingQuality = (): number => {
    if (completedQuestions.length === 0) return 0;
    const avgEvidence = evidenceMapData.length > 0 
      ? evidenceMapData.reduce((sum, section) => sum + section.evidenceStrength, 0) / evidenceMapData.length
      : 0.85; // Default high quality for demo
    return avgEvidence;
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Generated Draft Preview</h2>
              <p className="text-slate-600 mt-1">
                Review and edit your AI-generated grant responses
                {hasUnsavedChanges && (
                  <span className="ml-2 text-amber-600 font-medium">• Unsaved changes</span>
                )}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Select 
                value={selectedProject} 
                onValueChange={(value) => {
                  if (hasUnsavedChanges) {
                    const confirmSwitch = window.confirm(
                      "You have unsaved changes. Do you want to discard them and switch projects?"
                    );
                    if (!confirmSwitch) return;
                    setEditingQuestionId(null);
                    setEditedContent("");
                    setOriginalContent("");
                    setHasUnsavedChanges(false);
                  }
                  setSelectedProject(value);
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProject && (
                <div className="flex space-x-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      questions.forEach((q: any) => {
                        if (q.responseStatus === "pending") {
                          handleRegenerateResponse(q.id);
                        }
                      });
                    }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                  {completedQuestions.length > 0 && (
                    <Button 
                      variant={showEvidenceMap ? "default" : "outline"}
                      onClick={() => {
                        if (!showEvidenceMap) {
                          setEvidenceMapData(generateEvidenceMapData());
                        }
                        setShowEvidenceMap(!showEvidenceMap);
                      }}
                    >
                      <Target className="mr-2 h-4 w-4" />
                      Evidence Map
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectedProjectData && (
            <>
              {/* Draft Header */}
              <Card className="bg-slate-50 mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Badge className={getProjectStatusColor(selectedProjectData.status)}>
                        {getProjectStatusIcon(selectedProjectData.status)}
                        {getProjectStatusLabel(selectedProjectData.status)}
                      </Badge>
                      <span className="text-sm text-slate-600">
                        Last updated: {new Date(selectedProjectData.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedProjectData.status === 'draft' && completedQuestions.length > 0 && !hasUnsavedChanges && (
                      <Button 
                        onClick={handleFinalizeProject}
                        disabled={finalizingProject || hasUnsavedChanges}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {finalizingProject ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="mr-2 h-4 w-4" />
                        )}
                        Finalize Project
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Project</p>
                      <p className="text-slate-900">{selectedProjectData.title}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Funder</p>
                      <p className="text-slate-900">{selectedProjectData.funder}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Amount</p>
                      <p className="text-slate-900">{selectedProjectData.amount || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">Generated</p>
                      <p className="text-slate-900">
                        {new Date(selectedProjectData.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {selectedProjectData.status === 'final' && (
                    <div className="mt-4 p-3 bg-purple-50 border-l-4 border-purple-400 text-sm text-purple-800">
                      <p>
                        <CheckCircle2 className="inline mr-1 h-4 w-4" />
                        <strong>Project Finalized:</strong> This project is ready for submission. 
                        All responses have been completed and reviewed.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progress Indicator */}
              <div className="flex items-center space-x-4 mb-8">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <span className="text-sm text-slate-600">
                  {completedQuestions.length} of {totalQuestions} questions completed
                </span>
              </div>
            </>
          )}

          {!selectedProject ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Select a project to view drafts</h3>
              <p className="text-slate-600">Choose a project from the dropdown above to see generated responses.</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No questions found</h3>
              <p className="text-slate-600">Add questions to your project to generate responses.</p>
            </div>
          ) : (
            <>
              {/* Questions and Responses */}
              <div className="space-y-8">
                {questions.map((question: any, index: number) => {
                  const normalizedQuestion = normalizeQuestion(question);
                  
                  // Debug: Log what the render sees
                  if (index === 0) {
                    console.log("🎨 RENDER DEBUG - First question:", {
                      id: normalizedQuestion.id,
                      hasResponse: !!normalizedQuestion.response,
                      responseStatus: normalizedQuestion.responseStatus,
                      responsePreview: normalizedQuestion.response?.substring(0, 50) || "NO RESPONSE",
                      willDisplay: normalizedQuestion.response && 
                        (normalizedQuestion.responseStatus === "complete" || 
                         normalizedQuestion.responseStatus === "edited" || 
                         normalizedQuestion.responseStatus === "needs_context")
                    });
                  }
                  
                  return (
                  <Card key={question.id} className="border border-slate-200">
                    <CardHeader className="p-6 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="font-semibold text-slate-900 mb-2">
                            Question {index + 1}
                          </CardTitle>
                          <p className="text-slate-700 text-sm leading-relaxed">
                            {normalizedQuestion.question}
                            {normalizedQuestion.wordLimit && (
                              <span className="text-slate-500"> (Maximum {normalizedQuestion.wordLimit} words)</span>
                            )}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center space-x-2">
                          <Badge className={getStatusColor(normalizedQuestion.responseStatus)}>
                            {getStatusIcon(normalizedQuestion.responseStatus)}
                            {getStatusLabel(normalizedQuestion.responseStatus)}
                          </Badge>
                          {editingQuestionId === normalizedQuestion.id && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                              <Edit className="mr-1 h-3 w-3" />
                              Editing
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {normalizedQuestion.response && 
                       (normalizedQuestion.responseStatus === "complete" || 
                        normalizedQuestion.responseStatus === "edited" || 
                        normalizedQuestion.responseStatus === "needs_context") ? (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <span className="text-sm text-slate-600">
                                {normalizedQuestion.responseStatus === "edited" ? "Edited Response" : "Generated Response"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {editingQuestionId === normalizedQuestion.id ? wordCount : normalizedQuestion.response.split(' ').length} words
                              </span>
                              {normalizedQuestion.wordLimit && (
                                <span className={`text-xs ${
                                  (editingQuestionId === normalizedQuestion.id ? wordCount : normalizedQuestion.response.split(' ').length) <= normalizedQuestion.wordLimit
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}>
                                  {(editingQuestionId === normalizedQuestion.id ? wordCount : normalizedQuestion.response.split(' ').length) <= normalizedQuestion.wordLimit 
                                    ? "✓ Within limit" 
                                    : "⚠ Over limit"}
                                </span>
                              )}
                              {editingQuestionId === normalizedQuestion.id && hasUnsavedChanges && (
                                <span className="text-xs text-amber-600 flex items-center">
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Unsaved changes
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {editingQuestionId === normalizedQuestion.id ? (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={updateResponseMutation.isPending || !hasUnsavedChanges}
                                  >
                                    {updateResponseMutation.isPending ? (
                                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="mr-1 h-4 w-4" />
                                    )}
                                    Save
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleCancel}
                                    disabled={updateResponseMutation.isPending}
                                  >
                                    <X className="mr-1 h-4 w-4" />
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => startEditing(normalizedQuestion.id, normalizedQuestion.response)}
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRegenerateResponse(normalizedQuestion.id)}
                                    disabled={generateResponseMutation.isPending || generatingQuestionId === normalizedQuestion.id}
                                  >
                                    {generatingQuestionId === normalizedQuestion.id ? (
                                      <>
                                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <RotateCcw className="mr-1 h-4 w-4" />
                                        Regenerate
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            {editingQuestionId === normalizedQuestion.id ? (
                              <div className="space-y-4">
                                <Textarea
                                  value={editedContent}
                                  onChange={(e) => handleContentChange(e.target.value)}
                                  className="min-h-[200px] w-full font-normal text-sm leading-relaxed resize-none"
                                  placeholder="Enter your response here..."
                                />
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <div className="flex items-center space-x-4">
                                    <span>Auto-save enabled</span>
                                    <span className="text-slate-400">•</span>
                                    <span>Ctrl+S to save, Esc to cancel</span>
                                    {updateResponseMutation.isPending && (
                                      <>
                                        <span className="text-slate-400">•</span>
                                        <span className="flex items-center text-blue-600">
                                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                          Saving...
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    {normalizedQuestion.wordLimit && (
                                      <span className={wordCount > normalizedQuestion.wordLimit ? "text-red-600" : "text-green-600"}>
                                        {wordCount}/{normalizedQuestion.wordLimit} words
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                                  {normalizedQuestion.response}
                                </div>
                                <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm text-blue-800">
                                  <p>
                                    <Lightbulb className="inline mr-1 h-4 w-4" />
                                    <strong>AI Note:</strong> This response draws from your uploaded documents 
                                    to provide specific metrics and examples.
                                  </p>
                                </div>
                              </>
                            )}
                          </div>

                          {question.citations && question.citations.length > 0 && (
                            <div className="mt-6 border border-slate-200 bg-slate-50 rounded-lg p-4">
                              <div className="flex items-center mb-3">
                                <FileText className="h-4 w-4 text-blue-600 mr-2" />
                                <h5 className="text-sm font-semibold text-slate-800">Sources & Citations</h5>
                              </div>
                              <ul className="space-y-2 text-sm text-slate-700">
                                {question.citations.map((citation: any, citationIndex: number) => (
                                  <li key={`${question.id}-citation-${citationIndex}`} className="flex flex-col">
                                    <span className="font-medium text-slate-900">
                                      [{citationIndex + 1}] {citation.documentName || citation.documentId}
                                    </span>
                                    <span className="text-slate-600">
                                      Chunk {typeof citation.chunkIndex === "number" ? citation.chunkIndex + 1 : citationIndex + 1}
                                    </span>
                                    {citation.quote && (
                                      <span className="text-slate-500 text-xs mt-1">
                                        “{citation.quote.length > 200 ? `${citation.quote.slice(0, 200)}…` : citation.quote}”
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {question.assumptions && question.assumptions.length > 0 && (
                            <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 rounded-r-lg p-4 space-y-2">
                              <div className="flex items-center text-amber-700">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                <h5 className="text-sm font-semibold">Assumptions flagged by AI</h5>
                              </div>
                              <ul className="space-y-2 text-sm text-amber-800">
                                {question.assumptions.map((assumption: any, assumptionIndex: number) => (
                                  <li key={`${question.id}-assumption-${assumptionIndex}`} className="flex items-start space-x-2">
                                    <span className="font-medium text-amber-700">{assumptionIndex + 1}.</span>
                                    <div className="flex-1">
                                      <p>{assumption.text || assumption}</p>
                                      {assumption.category && (
                                        <p className="text-xs text-amber-600 mt-1 uppercase tracking-wide">{assumption.category}</p>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : normalizedQuestion.responseStatus === "generating" ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-slate-600">AI is generating your response...</p>
                            <p className="text-sm text-slate-500 mt-2">Using uploaded documents and organization data</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            {generatingQuestionId === normalizedQuestion.id ? (
                              <>
                                <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-600">AI is generating your response...</p>
                                <p className="text-sm text-slate-500 mt-2">This may take up to 60 seconds</p>
                              </>
                            ) : (
                              <>
                                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-4" />
                                <p className="text-slate-600">Response not generated yet</p>
                                <Button 
                                  className="mt-4"
                                  onClick={() => handleRegenerateResponse(normalizedQuestion.id)}
                                  disabled={generateResponseMutation.isPending}
                                >
                                  {generateResponseMutation.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="mr-2 h-4 w-4" />
                                      Generate Response
                                    </>
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>

              {/* Export Options */}
              {completedQuestions.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">
                        Export Options
                        {selectedProjectData.status === 'final' && (
                          <Badge className="ml-2 bg-purple-100 text-purple-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Final Version
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {selectedProjectData.status === 'final' 
                          ? "Export your finalized grant application ready for submission"
                          : "Export your draft grant application with professional formatting"
                        }
                        {hasUnsavedChanges && (
                          <span className="text-amber-600"> (Save changes before exporting)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button 
                        variant="outline" 
                        onClick={handleCopyToClipboard}
                        disabled={hasUnsavedChanges || exportingClipboard}
                      >
                        {exportingClipboard ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Copy className="mr-2 h-4 w-4" />
                        )}
                        Copy Text
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleExportWord}
                        disabled={hasUnsavedChanges || exportingWord}
                      >
                        {exportingWord ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="mr-2 h-4 w-4" />
                        )}
                        Export DOCX
                      </Button>
                      <Button 
                        onClick={handleExportPDF} 
                        className={selectedProjectData.status === 'final' 
                          ? "bg-purple-600 hover:bg-purple-700" 
                          : "bg-primary-600 hover:bg-primary-700"
                        }
                        disabled={hasUnsavedChanges || exportingPDF}
                      >
                        {exportingPDF ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="mr-2 h-4 w-4" />
                        )}
                        Export PDF
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Map */}
              {showEvidenceMap && completedQuestions.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <EvidenceMap
                    data={evidenceMapData}
                    overallGroundingQuality={calculateOverallGroundingQuality()}
                    onSectionClick={(sectionName) => {
                      console.log('Navigate to section:', sectionName);
                    }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      {selectedProject && questions.length > 0 && (
        <Card className="shadow-sm border border-slate-200">
          <CardHeader className="p-6 border-b border-slate-200">
            <CardTitle className="text-lg font-semibold text-slate-900">Version History</CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Track changes and compare different versions of your responses
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              <div className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium text-sm">v1</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Current Version</p>
                      <p className="text-sm text-slate-600">
                        Generated with Professional tone • {new Date().toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge className="bg-green-100 text-green-800">Current</Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
