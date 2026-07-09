import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { api, type Project } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { getAuthHeaders } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Keyboard,
  FileUp,
  Plus,
  Trash2,
  Wand2,
  X,
  Loader2,
} from "lucide-react";
import ClarificationPanel, { ClarificationQuestion } from "@/components/ClarificationPanel";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface QuestionDraft {
  id: string;
  question: string;
  wordLimit: number | null;
  priority: string;
}

interface QuestionsPanelProps {
  projectId: string;
  project: Project;
}

export function QuestionsPanel({ projectId, project }: QuestionsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [generationSettings, setGenerationSettings] = useState({
    tone: "professional",
    focusAreas: ["Impact", "Innovation"] as string[],
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showClarifications, setShowClarifications] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [focusAreaInput, setFocusAreaInput] = useState("");

  const loadProjectQuestions = async () => {
    try {
      const projectQuestions = await api.getQuestions(projectId);
      setQuestions(
        projectQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          wordLimit: q.wordLimit ?? null,
          priority: q.priority || "medium",
        })),
      );
    } catch (error) {
      console.error("Failed to load project questions:", error);
    }
  };

  useEffect(() => {
    setQuestions([]);
    setShowClarifications(false);
    setClarificationQuestions([]);
    loadProjectQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const saveQuestionsMutation = useMutation({
    mutationFn: async () => {
      const newQuestions = questions.filter((q) => !UUID_RE.test(q.id));
      for (const q of newQuestions) {
        await api.createQuestion(projectId, {
          question: q.question,
          wordLimit: q.wordLimit || undefined,
          priority: q.priority,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projectQuestions(project.organizationId, projectId) });
      toast({
        title: "Questions saved",
        description: "Your questions have been saved.",
      });
      loadProjectQuestions();
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save questions",
        variant: "destructive",
      });
    },
  });

  const generateResponsesMutation = useMutation({
    mutationFn: async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const clarificationResponse = await fetch('/api/clarifications/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({
            projectId,
            questions,
            organizationContext: {
              name: project.title,
              description: project.description,
            }
          })
        });

        if (clarificationResponse.ok) {
          const clarificationData = await clarificationResponse.json();
          setClarificationQuestions(clarificationData.questions || []);

          if (clarificationData.questions && clarificationData.questions.length > 0) {
            setShowClarifications(true);
            toast({
              title: "Clarifications needed",
              description: `${clarificationData.questions.length} questions will help improve your application quality.`,
            });
            return;
          }
        }
      } catch (error) {
        void error;
      }

      const questionIds = [];
      for (const q of questions) {
        if (UUID_RE.test(q.id)) {
          questionIds.push(q.id);
        } else {
          const created = await api.createQuestion(projectId, {
            question: q.question,
            wordLimit: q.wordLimit || undefined,
            priority: q.priority,
          });
          questionIds.push(created.id);
        }
      }

      const generatePromises = questionIds.map((qid) =>
        api.generateResponse(qid, {
          tone: generationSettings.tone,
          emphasisAreas: generationSettings.focusAreas
        })
      );

      // One bad question shouldn't block the rest from generating.
      await Promise.allSettled(generatePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projectQuestions(project.organizationId, projectId) });
      toast({
        title: `Generating ${questions.length} response${questions.length === 1 ? "" : "s"}`,
        description: "Head to Drafts to review them as they complete — this usually takes under a minute.",
      });
      loadProjectQuestions();
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "";
      const isBilling = msg.includes("402") || msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("plan");
      const isTimeout = msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out");
      toast({
        title: isBilling ? "Usage limit reached" : isTimeout ? "Generation timed out" : "Generation failed",
        description: isBilling
          ? "You've hit your plan limit. Upgrade your plan to generate more responses."
          : isTimeout
          ? "The request took too long. Try generating one question at a time."
          : msg || "Something went wrong. Check your documents are processed and try again.",
        variant: "destructive",
      });
    },
  });

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Math.random().toString(36).substr(2, 9),
        question: "",
        wordLimit: null,
        priority: "medium",
      },
    ]);
  };

  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleClarificationAnswer = (questionId: string, answer: string) => {
    setClarificationQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, isAnswered: true, answer } : q)),
    );
    toast({
      title: "Answer recorded",
      description: "Your clarification answer has been saved.",
    });
  };

  const handleSkipClarification = (questionId: string) => {
    setClarificationQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  const handleClarificationFollowUp = (_questionId: string) => {
    toast({
      title: "Follow-up requested",
      description: "Additional guidance will be provided for this question.",
    });
  };

  const proceedWithGeneration = async () => {
    try {
      const questionIds = [];
      for (const q of questions) {
        if (!UUID_RE.test(q.id)) {
          const created = await api.createQuestion(projectId, {
            question: q.question,
            wordLimit: q.wordLimit || undefined,
            priority: q.priority,
          });
          questionIds.push(created.id);
        } else {
          questionIds.push(q.id);
        }
      }

      const generatePromises = questionIds.map((qid) =>
        api.generateResponse(qid, {
          tone: generationSettings.tone,
          emphasisAreas: generationSettings.focusAreas
        })
      );
      await Promise.allSettled(generatePromises);

      setShowClarifications(false);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.projectQuestions(project.organizationId, projectId) });
      toast({
        title: "Generation started",
        description: "Responses are generating using your clarifications.",
      });
      loadProjectQuestions();
    } catch (_error) {
      toast({
        title: "Generation failed",
        description: "Failed to start generation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveQuestions = () => {
    if (questions.length === 0) {
      toast({
        title: "No questions added",
        description: "Add at least one question before saving.",
        variant: "destructive",
      });
      return;
    }
    saveQuestionsMutation.mutate();
  };

  const handleGenerateResponses = () => {
    if (questions.length === 0) {
      toast({
        title: "No questions added",
        description: "Add at least one question before generating responses.",
        variant: "destructive",
      });
      return;
    }

    const emptyQuestions = questions.filter((q) => !q.question.trim());
    if (emptyQuestions.length > 0) {
      toast({
        title: "Empty questions found",
        description: "Fill in all questions before generating responses.",
        variant: "destructive",
      });
      return;
    }

    generateResponsesMutation.mutate();
  };

  const addFocusArea = (area: string) => {
    if (area && !generationSettings.focusAreas.includes(area)) {
      setGenerationSettings({
        ...generationSettings,
        focusAreas: [...generationSettings.focusAreas, area],
      });
    }
  };

  const removeFocusArea = (area: string) => {
    setGenerationSettings({
      ...generationSettings,
      focusAreas: generationSettings.focusAreas.filter((a) => a !== area),
    });
  };

  const handleUploadDocument = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const result = await api.extractQuestions(file);
      const extractedQuestions = result.questions.map((question: string) => ({
        id: Math.random().toString(36).substr(2, 9),
        question: question.trim(),
        wordLimit: null,
        priority: "medium",
      }));
      setQuestions([...questions, ...extractedQuestions]);
      toast({
        title: "Questions extracted",
        description: result.demo
          ? `Loaded ${result.questions.length} placeholder questions (demo — add OPENAI_API_KEY server-side for real extraction).`
          : `Found ${result.questions.length} questions in the document.`,
      });
      setShowUploadModal(false);
    } catch (error) {
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "Could not process the document",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 gap-4 mb-8 lg:grid-cols-2 lg:gap-6">
            <Card className="border-2 border-primary-200 bg-primary-50">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Keyboard className="text-white h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Manual Input</h3>
                </div>
                <p className="text-slate-600 mb-4">
                  Copy and paste questions from grant applications or enter them manually.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    document.getElementById('questions-section')?.scrollIntoView({ behavior: 'smooth' });
                    addQuestion();
                  }}
                >
                  Start Manual Input
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center">
                    <FileUp className="text-white h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Upload Form</h3>
                </div>
                <p className="text-slate-600 mb-4">
                  Upload a PDF or Word document of the grant application form.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowUploadModal(true)}
                >
                  Upload Document
                </Button>
              </CardContent>
            </Card>
          </div>

          <div id="questions-section" className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">Application Questions</h3>
              <p className="text-sm text-slate-600 mt-1">Add the specific questions from the grant application</p>
            </div>

            {questions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                <Keyboard className="h-8 w-8 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-600 mb-1">No questions yet</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  Add questions manually or upload a grant application form above to extract them automatically.
                </p>
              </div>
            )}

            {questions.map((question, index) => (
              <Card key={question.id} className="border border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <Label className="text-sm font-medium text-slate-700">
                      Question {index + 1}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(question.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Enter the grant question here..."
                    value={question.question}
                    onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                    className="mb-3"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`wordLimit-${question.id}`} className="text-sm text-slate-600">
                        Word Limit:
                      </Label>
                      <Input
                        id={`wordLimit-${question.id}`}
                        type="number"
                        placeholder="500"
                        value={question.wordLimit || ""}
                        onChange={(e) => updateQuestion(question.id, 'wordLimit', parseInt(e.target.value) || null)}
                        className="w-24"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`priority-${question.id}`} className="text-sm text-slate-600">
                        Priority:
                      </Label>
                      <Select
                        value={question.priority}
                        onValueChange={(value) => updateQuestion(question.id, 'priority', value)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outline"
              onClick={addQuestion}
              className="border-2 border-dashed border-slate-300 w-full p-4 hover:border-slate-400"
            >
              <Plus className="text-slate-400 mr-2 h-4 w-4" />
              <span className="text-slate-600">Add Question</span>
            </Button>
          </div>

          <Card className="mt-8 bg-slate-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Generation Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="tone">Writing Tone</Label>
                  <Select value={generationSettings.tone} onValueChange={(value) =>
                    setGenerationSettings({ ...generationSettings, tone: value })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="data-driven">Data-Driven</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="persuasive">Persuasive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Focus Areas</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {generationSettings.focusAreas.map((area) => (
                      <Badge key={area} className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-800">
                        {area}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFocusArea(area)}
                          className="ml-1 p-0 h-auto text-primary hover:text-[#1559C9]"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      placeholder="e.g., Equity, Youth Development"
                      value={focusAreaInput}
                      onChange={(e) => setFocusAreaInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addFocusArea(focusAreaInput.trim());
                          setFocusAreaInput("");
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addFocusArea(focusAreaInput.trim());
                        setFocusAreaInput("");
                      }}
                      disabled={!focusAreaInput.trim()}
                      className="h-8 px-3 flex-shrink-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-3 mt-8 pt-6 border-t border-slate-200 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
            <Button
              variant="outline"
              onClick={handleSaveQuestions}
              disabled={saveQuestionsMutation.isPending}
              className="w-full sm:w-auto"
            >
              {saveQuestionsMutation.isPending ? "Saving..." : "Save questions"}
            </Button>
            <Button
              onClick={handleGenerateResponses}
              disabled={generateResponsesMutation.isPending || saveQuestionsMutation.isPending}
              className="w-full sm:w-auto"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {generateResponsesMutation.isPending ? "Generating..." : "Generate Responses"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showClarifications && clarificationQuestions.length > 0 && (
        <div className="space-y-4">
          <ClarificationPanel
            questions={clarificationQuestions}
            onAnswerSubmit={handleClarificationAnswer}
            onSkipQuestion={handleSkipClarification}
            onRequestFollowUp={handleClarificationFollowUp}
            isGenerating={generateResponsesMutation.isPending}
          />

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4 className="font-semibold text-blue-900 mb-1">Ready to Generate?</h4>
                  <p className="text-sm text-blue-700">
                    {clarificationQuestions.filter((q) => q.isAnswered).length} of {clarificationQuestions.length} clarifications completed.
                    You can proceed with generation or continue answering questions.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowClarifications(false)}
                    disabled={generateResponsesMutation.isPending}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Skip Clarifications
                  </Button>
                  <Button
                    onClick={proceedWithGeneration}
                    disabled={generateResponsesMutation.isPending}
                  >
                    {generateResponsesMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Generate Responses
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Grant Application Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Upload a PDF or Word document containing the grant application form.
              We'll automatically extract the questions for you.
            </p>
            {isProcessingFile ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-slate-600">Processing document...</span>
                </div>
              </div>
            ) : (
              <FileUpload
                onUpload={handleUploadDocument}
                accept=".pdf,.doc,.docx"
                multiple={false}
                showToast={false}
                description={
                  <>
                    Upload your grant application form — or{" "}
                    <span className="font-semibold text-[#2186EB]">browse files</span>
                  </>
                }
                fileTypesHint="PDF · DOC · DOCX — up to 10 MB each"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
