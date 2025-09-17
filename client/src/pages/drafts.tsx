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
  BookOpen
} from "lucide-react";
import CitationTooltip from "@/components/CitationTooltip";
import EvidenceMap, { EvidenceMapData } from "@/components/EvidenceMap";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProject, "questions"] });
      toast({
        title: "Response generated",
        description: "AI has generated a new response for your question.",
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
    generateResponseMutation.mutate({
      questionId,
      tone: "professional",
      emphasisAreas: ["Impact & Outcomes", "Innovation"]
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
  const completedQuestions = questions.filter((q: any) => q.responseStatus === "complete" || q.responseStatus === "edited");
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
                {questions.map((question: any, index: number) => (
                  <Card key={question.id} className="border border-slate-200">
                    <CardHeader className="p-6 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="font-semibold text-slate-900 mb-2">
                            Question {index + 1}
                          </CardTitle>
                          <p className="text-slate-700 text-sm leading-relaxed">
                            {question.question}
                            {question.wordLimit && (
                              <span className="text-slate-500"> (Maximum {question.wordLimit} words)</span>
                            )}
                          </p>
                        </div>
                        <div className="ml-4 flex items-center space-x-2">
                          <Badge className={getStatusColor(question.responseStatus)}>
                            {getStatusIcon(question.responseStatus)}
                            {getStatusLabel(question.responseStatus)}
                          </Badge>
                          {editingQuestionId === question.id && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                              <Edit className="mr-1 h-3 w-3" />
                              Editing
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {(question.responseStatus === "complete" || question.responseStatus === "edited") && question.response ? (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <span className="text-sm text-slate-600">
                                {question.responseStatus === "edited" ? "Edited Response" : "Generated Response"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {editingQuestionId === question.id ? wordCount : question.response.split(' ').length} words
                              </span>
                              {question.wordLimit && (
                                <span className={`text-xs ${
                                  (editingQuestionId === question.id ? wordCount : question.response.split(' ').length) <= question.wordLimit
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}>
                                  {(editingQuestionId === question.id ? wordCount : question.response.split(' ').length) <= question.wordLimit 
                                    ? "✓ Within limit" 
                                    : "⚠ Over limit"}
                                </span>
                              )}
                              {editingQuestionId === question.id && hasUnsavedChanges && (
                                <span className="text-xs text-amber-600 flex items-center">
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Unsaved changes
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {editingQuestionId === question.id ? (
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
                                    onClick={() => startEditing(question.id, question.response)}
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Edit
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRegenerateResponse(question.id)}
                                    disabled={generateResponseMutation.isPending}
                                  >
                                    <RotateCcw className="mr-1 h-4 w-4" />
                                    Regenerate
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none">
                            {editingQuestionId === question.id ? (
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
                                    {question.wordLimit && (
                                      <span className={wordCount > question.wordLimit ? "text-red-600" : "text-green-600"}>
                                        {wordCount}/{question.wordLimit} words
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                                  {question.response}
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
                        </>
                      ) : question.responseStatus === "generating" ? (
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
                            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-600">Response not generated yet</p>
                            <Button 
                              className="mt-4"
                              onClick={() => handleRegenerateResponse(question.id)}
                              disabled={generateResponseMutation.isPending}
                            >
                              Generate Response
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
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
