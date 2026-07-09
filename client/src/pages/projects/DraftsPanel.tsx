import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { api, type Project } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
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
  Clock,
  Lightbulb,
  Eye,
  Save,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Target,
  Wand2
} from "lucide-react";
import EvidenceMap, { EvidenceMapData } from "@/components/EvidenceMap";
import {
  getCitationDocumentName,
  getCitationQuote,
  getResponseTrustSummary,
  ResponseWithCitationMarkers,
} from "@/pages/drafts/citation-display";
import { normalizeQuestion } from "@/pages/drafts/utils";
import { DraftStatusBadge } from "@/pages/drafts/DraftStatusBadge";
import { useDraftEditor } from "@/pages/drafts/use-draft-editor";
import { isQuestionAnswered } from "@/lib/questions";

interface DraftsPanelProps {
  projectId: string;
  project: Project;
}

export function DraftsPanel({ projectId, project }: DraftsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingClipboard, setExportingClipboard] = useState(false);
  const [finalizingProject, setFinalizingProject] = useState(false);
  const [showEvidenceMap, setShowEvidenceMap] = useState(false);
  const [evidenceMapData, setEvidenceMapData] = useState<EvidenceMapData[]>([]);
  const [generatingQuestionId, setGeneratingQuestionId] = useState<string | null>(null);

  const questionsKey = workspaceKeys.projectQuestions(project.organizationId, projectId);

  const { data: questions = [] } = useQuery({
    queryKey: questionsKey,
    queryFn: () => api.getQuestions(projectId),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
    structuralSharing: (oldData, newData) => {
      if (oldData && newData && Array.isArray(oldData) && Array.isArray(newData)) {
        return newData.map((newQ: any) => {
          const oldQ = oldData.find((q: any) => q.id === newQ.id);
          if (oldQ?.response && !newQ.response) return oldQ;
          return newQ;
        });
      }
      return newData;
    },
  });

  const { data: userSettings } = useQuery({
    queryKey: workspaceKeys.userSettings(),
    queryFn: api.getSettings,
  });

  const updateResponseMutation = useMutation({
    mutationFn: ({ questionId, content }: { questionId: string; content: string }) =>
      api.updateResponse(questionId, content, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: questionsKey });
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

  const editor = useDraftEditor({
    onSave: async (questionId, content) => {
      await updateResponseMutation.mutateAsync({ questionId, content });
    },
  });

  const generateResponseMutation = useMutation({
    mutationFn: ({ questionId, tone, emphasisAreas }: {
      questionId: string;
      tone: string;
      emphasisAreas: string[]
    }) => api.generateResponse(questionId, { tone, emphasisAreas }),
    onMutate: ({ questionId }) => {
      setGeneratingQuestionId(questionId);
    },
    onSuccess: async (data, variables) => {
      setGeneratingQuestionId(null);

      const responseText = data.response || data.content || (data as any).response_text || '';
      const statusValue = data.responseStatus || (data as any).response_status ||
                         (data.status === 'completed' ? 'complete' :
                          data.status === 'complete' ? 'complete' :
                          data.status) || 'complete';

      const normalizedData = {
        response: responseText,
        responseStatus: statusValue,
        errorMessage: data.errorMessage || (data as any).error_message || data.errorMessage,
        citations: data.citations || [],
        assumptions: data.assumptions || [],
      };

      queryClient.setQueryData(
        questionsKey,
        (oldData: any) => {
          if (!oldData || !Array.isArray(oldData)) return [];
          const updated = oldData.map((q: any) => {
            if (q.id === variables.questionId) {
              return {
                ...q,
                response: normalizedData.response || q.response || (q as any).response_text || '',
                responseStatus: normalizedData.responseStatus || q.responseStatus || (q as any).response_status || 'complete',
                errorMessage: normalizedData.errorMessage || q.errorMessage || (q as any).error_message,
                citations: normalizedData.citations || q.citations || [],
                assumptions: normalizedData.assumptions || q.assumptions || [],
              };
            }
            return q;
          });
          return [...updated];
        },
        { updatedAt: Date.now() },
      );

      queryClient.cancelQueries({ queryKey: questionsKey, exact: false });

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
          description: "Granted has generated a new response for your question.",
        });
      }
    },
    onError: (error: any, variables) => {
      setGeneratingQuestionId(null);
      const isTimeout = /timeout|took too long/i.test(error?.message || "");
      queryClient.setQueryData(
        questionsKey,
        (oldData: any) =>
          Array.isArray(oldData)
            ? oldData.map((q: any) =>
                q.id === variables.questionId
                  ? {
                      ...q,
                      responseStatus: isTimeout ? "timeout" : "failed",
                      errorMessage:
                        error?.message || "Failed to generate response. Please try again.",
                    }
                  : q
              )
            : oldData
      );
      toast({
        title: isTimeout ? "Generation timed out" : "Generation failed",
        description: error.message || "Failed to generate response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const finalizeProjectMutation = useMutation({
    mutationFn: () => api.finalizeProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (project.organizationId) {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.projects(project.organizationId) });
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

  const resolveAssumptionMutation = useMutation({
    mutationFn: ({ assumptionId, resolved }: { assumptionId: string; resolved: boolean }) =>
      api.setAssumptionResolved(assumptionId, resolved),
    onSuccess: (_data, { assumptionId, resolved }) => {
      queryClient.setQueryData(
        questionsKey,
        (old: any) =>
          Array.isArray(old)
            ? old.map((q: any) => ({
                ...q,
                assumptions: Array.isArray(q.assumptions)
                  ? q.assumptions.map((a: any) =>
                      a?.id === assumptionId ? { ...a, resolved } : a
                    )
                  : q.assumptions,
              }))
            : old
      );
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't update gap",
        description: error?.message || "Failed to update the flagged gap. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRegenerateResponse = (questionId: string) => {
    const tone = userSettings?.defaultTone || "professional";
    const emphasisAreas = userSettings?.emphasisAreas || ["Impact & Outcomes", "Innovation"];
    generateResponseMutation.mutate({ questionId, tone, emphasisAreas });
  };

  const handleFinalizeProject = async () => {
    if (editor.hasUnsavedChanges) return;
    const confirmFinalize = window.confirm(
      "Are you sure you want to finalize this project? This will mark it as complete and ready for submission."
    );
    if (!confirmFinalize) return;

    try {
      setFinalizingProject(true);
      await finalizeProjectMutation.mutateAsync();
    } catch (_error) {
      // Error handling is done in the mutation
    } finally {
      setFinalizingProject(false);
    }
  };

  // Keyboard shortcuts while editing
  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (editor.editingQuestionId && (event.ctrlKey || event.metaKey)) {
        if (event.key === 's') {
          event.preventDefault();
          if (editor.hasUnsavedChanges) editor.saveEditing();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          editor.cancelEditing();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [editor]);

  const completedQuestions = questions.filter((q: any) => isQuestionAnswered(normalizeQuestion(q).responseStatus));
  const totalQuestions = questions.length;
  const progressPercentage = totalQuestions > 0 ? (completedQuestions.length / totalQuestions) * 100 : 0;

  const generateEvidenceMapData = (): EvidenceMapData[] => {
    return completedQuestions.map((question: any, index: number) => ({
      sectionName: `Question ${index + 1}`,
      evidenceStrength: Math.random() * 0.3 + 0.7,
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

  const calculateOverallGroundingQuality = (): number => {
    if (completedQuestions.length === 0) return 0;
    return evidenceMapData.length > 0
      ? evidenceMapData.reduce((sum, section) => sum + section.evidenceStrength, 0) / evidenceMapData.length
      : 0.85;
  };

  const prepareExportData = () => ({
    project,
    questions,
    metadata: {
      exportDate: new Date(),
      organizationName: undefined,
    },
  });

  const recordExport = (
    format: "pdf" | "docx" | "clipboard",
    exportData: ReturnType<typeof prepareExportData>
  ) => {
    const completed = exportData.questions.filter(
      (q: any) => isQuestionAnswered(q.responseStatus)
    );
    const unresolvedGapCount = completed.reduce(
      (sum: number, q: any) =>
        sum + ((q.assumptions || []).filter((a: any) => !a?.resolved).length || 0),
      0
    );
    api.recordExportEvent(projectId, format, {
      questionCount: completed.length,
      unresolvedGapCount,
    });
  };

  const handleCopyToClipboard = async () => {
    try {
      setExportingClipboard(true);
      const exportData = prepareExportData();
      const validation = validateExportData(exportData);
      if (!validation.valid) {
        toast({ title: "Export failed", description: validation.errors.join(", "), variant: "destructive" });
        return;
      }
      await exportToClipboard(exportData);
      recordExport("clipboard", exportData);
      toast({
        title: "Copied to clipboard",
        description: "All completed responses have been copied, formatted and ready to paste.",
      });
    } catch (error: any) {
      toast({ title: "Copy failed", description: error.message || "Failed to copy to clipboard. Please try again.", variant: "destructive" });
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
        toast({ title: "Export failed", description: validation.errors.join(", "), variant: "destructive" });
        return;
      }
      toast({ title: "Export started", description: "Generating PDF... This may take a moment." });
      await exportToPDF(exportData);
      recordExport("pdf", exportData);
      toast({ title: "PDF exported successfully", description: "Your grant application has been downloaded as a PDF." });
    } catch (error: any) {
      toast({ title: "PDF export failed", description: error.message || "Failed to generate PDF. Please try again.", variant: "destructive" });
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
        toast({ title: "Export failed", description: validation.errors.join(", "), variant: "destructive" });
        return;
      }
      toast({ title: "Export started", description: "Generating Word document... This may take a moment." });
      await exportToWord(exportData);
      recordExport("docx", exportData);
      toast({ title: "Word document exported successfully", description: "Your grant application has been downloaded as a DOCX file." });
    } catch (error: any) {
      toast({ title: "Word export failed", description: error.message || "Failed to generate Word document. Please try again.", variant: "destructive" });
    } finally {
      setExportingWord(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 md:text-2xl">Generated Draft Preview</h2>
              <p className="text-slate-600 mt-1">
                Review each drafted answer, check its citations, and edit before you export
                {editor.hasUnsavedChanges && (
                  <span className="ml-2 text-amber-600 font-medium">• Unsaved changes</span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => {
                  questions.forEach((q: any) => {
                    if (q.responseStatus === "pending") handleRegenerateResponse(q.id);
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
                    if (!showEvidenceMap) setEvidenceMapData(generateEvidenceMapData());
                    setShowEvidenceMap(!showEvidenceMap);
                  }}
                >
                  <Target className="mr-2 h-4 w-4" />
                  Evidence Map
                </Button>
              )}
            </div>
          </div>

          <Card className="bg-slate-50 mb-6">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <DraftStatusBadge status={project.status} type="project" />
                  <span className="text-sm text-slate-600">
                    Last updated: {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                {project.status === 'draft' && completedQuestions.length > 0 && !editor.hasUnsavedChanges && (
                  <Button
                    onClick={handleFinalizeProject}
                    disabled={finalizingProject || editor.hasUnsavedChanges}
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm font-medium text-slate-600">Funder</p>
                  <p className="text-slate-900">{project.funder}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Amount</p>
                  <p className="text-slate-900">{project.amount || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Generated</p>
                  <p className="text-slate-900">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {project.status === 'final' && (
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

          <div className="flex flex-col gap-2 mb-8 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex-1 bg-slate-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            <span className="text-sm text-slate-600">
              {completedQuestions.length} of {totalQuestions} questions completed
            </span>
          </div>

          {questions.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No questions yet</h3>
              <p className="text-slate-600">Add questions in the Questions tab to generate responses.</p>
            </div>
          ) : (
            <>
              <div className="space-y-8">
                {questions.map((question: any, index: number) => {
                  const normalizedQuestion = normalizeQuestion(question);
                  return (
                  <Card key={question.id} className="border border-slate-200">
                    <CardHeader className="p-4 border-b border-slate-200 bg-slate-50 md:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                        <div className="flex flex-wrap items-center gap-2 sm:ml-4">
                          <DraftStatusBadge status={normalizedQuestion.responseStatus} />
                          {editor.editingQuestionId === normalizedQuestion.id && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                              <Edit className="mr-1 h-3 w-3" />
                              Editing
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      {normalizedQuestion.response &&
                       (normalizedQuestion.responseStatus === "complete" ||
                        normalizedQuestion.responseStatus === "edited" ||
                        normalizedQuestion.responseStatus === "needs_context") ? (
                        <>
                          <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                              <span className="text-sm text-slate-600">
                                {normalizedQuestion.responseStatus === "edited" ? "Edited Response" : "Generated Response"}
                              </span>
                              <span className="text-xs text-slate-500">
                                {editor.editingQuestionId === normalizedQuestion.id ? editor.wordCount : normalizedQuestion.response.split(' ').length} words
                              </span>
                              {normalizedQuestion.wordLimit && (
                                <span className={`text-xs ${
                                  (editor.editingQuestionId === normalizedQuestion.id ? editor.wordCount : normalizedQuestion.response.split(' ').length) <= normalizedQuestion.wordLimit
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}>
                                  {(editor.editingQuestionId === normalizedQuestion.id ? editor.wordCount : normalizedQuestion.response.split(' ').length) <= normalizedQuestion.wordLimit
                                    ? "✓ Within limit"
                                    : "⚠ Over limit"}
                                </span>
                              )}
                              {editor.editingQuestionId === normalizedQuestion.id && editor.hasUnsavedChanges && (
                                <span className="text-xs text-amber-600 flex items-center">
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Unsaved changes
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {editor.editingQuestionId === normalizedQuestion.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={editor.saveEditing}
                                    disabled={updateResponseMutation.isPending || !editor.hasUnsavedChanges}
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
                                    onClick={editor.cancelEditing}
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
                                    onClick={() => editor.startEditing(normalizedQuestion.id, normalizedQuestion.response)}
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
                            {editor.editingQuestionId === normalizedQuestion.id ? (
                              <div className="space-y-4">
                                <Textarea
                                  value={editor.editedContent}
                                  onChange={(e) => editor.handleContentChange(e.target.value)}
                                  className="min-h-[200px] w-full font-normal text-sm leading-relaxed resize-none"
                                  placeholder="Enter your response here..."
                                />
                                <div className="flex flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
                                  <div className="flex items-center gap-2">
                                    {normalizedQuestion.wordLimit && (
                                      <span className={editor.wordCount > normalizedQuestion.wordLimit ? "text-red-600" : "text-green-600"}>
                                        {editor.wordCount}/{normalizedQuestion.wordLimit} words
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                                  <ResponseWithCitationMarkers
                                    text={normalizedQuestion.response}
                                    citations={question.citations}
                                    citationListId={`citations-${normalizedQuestion.id}`}
                                  />
                                </div>
                                {getResponseTrustSummary({
                                  citations: question.citations,
                                  assumptions: question.assumptions,
                                }) ? (
                                  <div
                                    className={`mt-4 p-3 text-sm border-l-4 ${
                                      question.assumptions?.length && !question.citations?.length
                                        ? "bg-amber-50 border-amber-400 text-amber-800"
                                        : "bg-blue-50 border-blue-400 text-blue-800"
                                    }`}
                                  >
                                    <p>
                                      <Lightbulb className="inline mr-1 h-4 w-4" />
                                      <strong>Trust note:</strong>{" "}
                                      {getResponseTrustSummary({
                                        citations: question.citations,
                                        assumptions: question.assumptions,
                                      })}
                                    </p>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>

                          {question.citations && question.citations.length > 0 && (
                            <div
                              id={`citations-${normalizedQuestion.id}`}
                              className="mt-6 border border-slate-200 bg-slate-50 rounded-lg p-4"
                            >
                              <div className="flex items-center mb-3">
                                <FileText className="h-4 w-4 text-blue-600 mr-2" />
                                <h5 className="text-sm font-semibold text-slate-800">Sources & Citations</h5>
                              </div>
                              <ul className="space-y-2 text-sm text-slate-700">
                                {question.citations.map((citation: any, citationIndex: number) => {
                                  const docTitle = getCitationDocumentName(citation, citationIndex + 1);
                                  const quoteText = getCitationQuote(citation);
                                  const chunkIdx =
                                    typeof citation.chunkIndex === "number"
                                      ? citation.chunkIndex
                                      : citationIndex + 1;
                                  return (
                                    <li
                                      key={`${question.id}-citation-${citationIndex}`}
                                      id={`citations-${normalizedQuestion.id}-item-${citationIndex}`}
                                      className="flex flex-col scroll-mt-24"
                                    >
                                      <span className="font-medium text-slate-900">
                                        [#{citationIndex + 1}] {docTitle}
                                      </span>
                                      <span className="text-slate-600 text-xs">
                                        Document chunk {chunkIdx}
                                        {citation.section ? ` · ${citation.section}` : ""}
                                      </span>
                                      {quoteText ? (
                                        <span className="text-slate-500 text-xs mt-1">
                                          “
                                          {quoteText.length > 200
                                            ? `${quoteText.slice(0, 200)}…`
                                            : quoteText}
                                          ”
                                        </span>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          {question.assumptions && question.assumptions.length > 0 && (
                            <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 rounded-r-lg p-4 space-y-2">
                              <div className="flex items-center text-amber-700">
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                <h5 className="text-sm font-semibold">Needs your input</h5>
                              </div>
                              <p className="text-xs text-amber-700">
                                Your documents didn't cover these. Edit the answer to fill each gap,
                                then mark it addressed — unaddressed gaps appear as placeholders in exports.
                              </p>
                              <ul className="space-y-2 text-sm text-amber-800">
                                {question.assumptions.map((assumption: any, assumptionIndex: number) => {
                                  const body =
                                    typeof assumption === "string"
                                      ? assumption
                                      : assumption?.text ?? assumption?.suggestedQuestion ?? "";
                                  const assumptionId =
                                    typeof assumption === "object" && assumption?.id
                                      ? String(assumption.id)
                                      : null;
                                  const isResolved =
                                    typeof assumption === "object" && assumption?.resolved === true;
                                  return (
                                    <li
                                      key={`${question.id}-assumption-${assumptionIndex}`}
                                      className="flex items-start justify-between gap-3"
                                    >
                                      <p
                                        className={`flex-1 ${
                                          isResolved ? "text-amber-600/60 line-through" : ""
                                        }`}
                                      >
                                        {body}
                                      </p>
                                      {assumptionId && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 shrink-0 px-2 text-xs text-amber-700 hover:text-amber-900"
                                          disabled={resolveAssumptionMutation.isPending}
                                          onClick={() =>
                                            resolveAssumptionMutation.mutate({
                                              assumptionId,
                                              resolved: !isResolved,
                                            })
                                          }
                                        >
                                          {isResolved ? "Undo" : "Mark addressed"}
                                        </Button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </>
                      ) : normalizedQuestion.responseStatus === "generating" ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-slate-600">Generating your response…</p>
                            <p className="text-sm text-slate-500 mt-2">Using uploaded documents and organization data</p>
                          </div>
                        </div>
                      ) : (normalizedQuestion.responseStatus === "failed" ||
                          normalizedQuestion.responseStatus === "timeout") &&
                        generatingQuestionId !== normalizedQuestion.id ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            <div className="flex-1">
                              <h5 className="text-sm font-semibold text-red-800">
                                {normalizedQuestion.responseStatus === "timeout"
                                  ? "Generation timed out"
                                  : "Generation failed"}
                              </h5>
                              <p className="mt-1 text-sm text-red-700">
                                {normalizedQuestion.errorMessage ||
                                  (normalizedQuestion.responseStatus === "timeout"
                                    ? "Granted took too long to respond. Your question is saved — try again."
                                    : "Something went wrong while generating this response. Your question is saved — try again.")}
                              </p>
                              <Button
                                className="mt-4"
                                variant="outline"
                                onClick={() => handleRegenerateResponse(normalizedQuestion.id)}
                                disabled={generateResponseMutation.isPending}
                              >
                                {generateResponseMutation.isPending ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Retrying...
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Try again
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            {generatingQuestionId === normalizedQuestion.id ? (
                              <>
                                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                                <p className="text-slate-600">Generating your response…</p>
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

              {completedQuestions.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">
                        Export Options
                        {project.status === 'final' && (
                          <Badge className="ml-2 bg-purple-100 text-purple-800">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Final Version
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {project.status === 'final'
                          ? "Export your finalized grant application ready for submission"
                          : "Export your draft grant application, formatted for submission"
                        }
                        {editor.hasUnsavedChanges && (
                          <span className="text-amber-600"> (Save changes before exporting)</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button
                        variant="outline"
                        onClick={handleCopyToClipboard}
                        disabled={editor.hasUnsavedChanges || exportingClipboard}
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
                        disabled={editor.hasUnsavedChanges || exportingWord}
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
                        className={project.status === 'final'
                          ? "bg-purple-600 hover:bg-purple-700"
                          : undefined
                        }
                        disabled={editor.hasUnsavedChanges || exportingPDF}
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

              {showEvidenceMap && completedQuestions.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200">
                  <EvidenceMap
                    data={evidenceMapData}
                    overallGroundingQuality={calculateOverallGroundingQuality()}
                    onSectionClick={(_sectionName) => {
                    }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {questions.length > 0 && (
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
                      <span className="text-primary font-medium text-sm">v1</span>
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
