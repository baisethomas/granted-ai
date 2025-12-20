import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { api } from "@/lib/api";
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
  HelpCircle
} from "lucide-react";
import ClarificationPanel, { ClarificationQuestion } from "@/components/ClarificationPanel";

export default function Forms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [projectForm, setProjectForm] = useState({
    title: "",
    funder: "",
    amount: "",
    deadline: "",
    description: "",
  });

  const [questions, setQuestions] = useState<Array<{
    id: string;
    question: string;
    wordLimit: number | null;
    priority: string;
  }>>([]);

  const [generationSettings, setGenerationSettings] = useState({
    tone: "professional",
    focusAreas: ["Impact", "Innovation"] as string[],
  });

  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showClarifications, setShowClarifications] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: api.getProjects,
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: api.getSettings,
  });

  // Load project data when a project is selected
  const handleProjectSelect = (projectId: string) => {
    if (projectId === "new") {
      // Clear form for new project
      setCurrentProject(null);
      setProjectForm({
        title: "",
        funder: "",
        amount: "",
        deadline: "",
        description: "",
      });
      setQuestions([]);
    } else {
      // Load selected project data
      const project = projects.find((p: any) => p.id === projectId);
      if (project) {
        setCurrentProject(projectId);
        setProjectForm({
          title: project.title || "",
          funder: project.funder || "",
          amount: project.amount || "",
          deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : "",
          description: project.description || "",
        });
        // Load questions for this project
        loadProjectQuestions(projectId);
      }
    }
  };

  const loadProjectQuestions = async (projectId: string) => {
    try {
      const projectQuestions = await api.getQuestions(projectId);
      const formattedQuestions = projectQuestions.map((q: any) => ({
        id: q.id,
        question: q.question,
        wordLimit: q.wordLimit,
        priority: q.priority || "medium",
      }));
      setQuestions(formattedQuestions);
    } catch (error) {
      console.error("Failed to load project questions:", error);
    }
  };

  const createProjectMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setCurrentProject(project.id);
      toast({
        title: "Project created",
        description: "Your grant application project has been created.",
      });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async () => {
      // Prepare project data with proper date formatting
      const projectData = {
        title: projectForm.title,
        funder: projectForm.funder,
        amount: projectForm.amount || undefined,
        deadline: projectForm.deadline ? new Date(projectForm.deadline) : undefined,
        description: projectForm.description || undefined,
      };

      // Create project first if needed
      let pid = currentProject;
      if (!pid) {
        const project = await api.createProject(projectData);
        pid = project.id;
        setCurrentProject(pid);
      } else {
        // Update existing project
        await api.updateProject(pid, projectData);
      }

      // Create new questions only (filter out existing ones by checking if id is a UUID)
      const newQuestions = questions.filter(q => !q.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
      
      for (const q of newQuestions) {
        await api.createQuestion(pid, {
          question: q.question,
          wordLimit: q.wordLimit || undefined,
          priority: q.priority,
        });
      }

      return pid;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Draft saved",
        description: "Your grant application draft has been saved successfully.",
      });
      // Reload questions to get proper IDs
      if (projectId) {
        loadProjectQuestions(projectId);
      }
    },
    onError: (error) => {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save draft",
        variant: "destructive",
      });
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: ({ projectId, question }: { projectId: string; question: any }) =>
      api.createQuestion(projectId, question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (currentProject) {
        // Reload questions for the current project
        loadProjectQuestions(currentProject);
      }
    },
  });

  const generateResponsesMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // Prepare project data with proper date formatting
      const projectData = {
        title: projectForm.title,
        funder: projectForm.funder,
        amount: projectForm.amount || undefined,
        deadline: projectForm.deadline ? new Date(projectForm.deadline) : undefined,
        description: projectForm.description || undefined,
      };

      // Create project first if needed
      let pid = projectId;
      if (!pid) {
        const project = await api.createProject(projectData);
        pid = project.id;
        setCurrentProject(pid);
      } else {
        // Update existing project
        await api.updateProject(pid, projectData);
      }

      // First, analyze for clarifications
      try {
        const authHeaders = await getAuthHeaders();
        const clarificationResponse = await fetch('/api/clarifications/analyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({
            projectId: pid,
            questions: questions,
            organizationContext: {
              name: projectForm.title,
              description: projectForm.description
            }
          })
        });
        
        if (clarificationResponse.ok) {
          const clarificationData = await clarificationResponse.json();
          setClarificationQuestions(clarificationData.questions || []);
          
          if (clarificationData.questions && clarificationData.questions.length > 0) {
            // Show clarification panel instead of generating immediately
            setShowClarifications(true);
            toast({
              title: "Clarifications needed",
              description: `${clarificationData.questions.length} questions will help improve your application quality.`,
            });
            return pid;
          }
        }
      } catch (error) {
        console.warn('Clarification analysis failed, proceeding with generation:', error);
      }

      // Create questions and get their IDs (only create new questions)
      const questionIds = [];
      
      for (const q of questions) {
        // Check if this is an existing question (has a UUID format id)
        const isExistingQuestion = q.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        
        if (isExistingQuestion) {
          // Use existing question ID
          questionIds.push(q.id);
        } else {
          // Create new question
          const createdQuestion = await api.createQuestion(pid, {
            question: q.question,
            wordLimit: q.wordLimit || undefined,
            priority: q.priority,
          });
          questionIds.push(createdQuestion.id);
        }
      }

      // Start generating responses for all questions
      const generatePromises = questionIds.map(qid => 
        api.generateResponse(qid, {
          tone: generationSettings.tone,
          emphasisAreas: generationSettings.focusAreas
        })
      );

      // Wait for all responses to start generating (they will continue in background)
      await Promise.allSettled(generatePromises);

      return pid;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Responses generating",
        description: "AI is generating responses for your questions. View progress in the drafts section.",
      });
      // Reload questions to get proper IDs and statuses
      if (projectId) {
        loadProjectQuestions(projectId);
      }
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate responses",
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

  // Clarification handlers
  const handleClarificationAnswer = (questionId: string, answer: string) => {
    setClarificationQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { ...q, isAnswered: true, answer }
          : q
      )
    );
    
    toast({
      title: "Answer recorded",
      description: "Your clarification answer has been saved.",
    });
  };

  const handleSkipClarification = (questionId: string) => {
    setClarificationQuestions(prev => 
      prev.filter(q => q.id !== questionId)
    );
  };

  const handleClarificationFollowUp = (questionId: string) => {
    toast({
      title: "Follow-up requested",
      description: "Additional guidance will be provided for this question.",
    });
  };

  const proceedWithGeneration = async () => {
    if (!currentProject) return;
    
    // Proceed with generation using the existing logic
    try {
      const questionIds = [];
      for (const q of questions) {
        if (!q.id.startsWith('existing-')) { // Only create new questions
          const createdQuestion = await api.createQuestion(currentProject, {
            question: q.question,
            wordLimit: q.wordLimit || undefined,
            priority: q.priority,
          });
          questionIds.push(createdQuestion.id);
        }
      }

      // Start generating responses
      const generatePromises = questionIds.map(qid => 
        api.generateResponse(qid, {
          tone: generationSettings.tone,
          emphasisAreas: generationSettings.focusAreas
        })
      );

      await Promise.allSettled(generatePromises);
      
      setShowClarifications(false);
      toast({
        title: "Generation started",
        description: "AI is generating responses using your clarifications.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Failed to start generation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateQuestion = (id: string, field: string, value: any) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSaveDraft = () => {
    if (!projectForm.title || !projectForm.funder) {
      toast({
        title: "Missing information",
        description: "Please fill in the project title and funder.",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "No questions added",
        description: "Please add at least one question before saving.",
        variant: "destructive",
      });
      return;
    }

    console.log("Saving draft with data:", { projectForm, questions });
    saveProjectMutation.mutate();
  };

  const handleGenerateResponses = () => {
    if (!projectForm.title || !projectForm.funder) {
      toast({
        title: "Missing information",
        description: "Please fill in the project title and funder.",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "No questions added",
        description: "Please add at least one question before generating responses.",
        variant: "destructive",
      });
      return;
    }

    // Check if all questions have content
    const emptyQuestions = questions.filter(q => !q.question.trim());
    if (emptyQuestions.length > 0) {
      toast({
        title: "Empty questions found",
        description: "Please fill in all questions before generating responses.",
        variant: "destructive",
      });
      return;
    }

    generateResponsesMutation.mutate(currentProject || "");
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
      focusAreas: generationSettings.focusAreas.filter(a => a !== area),
    });
  };

  const handleUploadDocument = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const result = await api.extractQuestions(file);
      
      // Convert extracted questions to the format expected by the form
      const extractedQuestions = result.questions.map((question: string) => ({
        id: Math.random().toString(36).substr(2, 9),
        question: question.trim(),
        wordLimit: null,
        priority: "medium",
      }));
      
      // Add extracted questions to existing questions
      setQuestions([...questions, ...extractedQuestions]);
      
      toast({
        title: "Questions extracted successfully",
        description: `Found ${result.questions.length} questions in the document.`,
      });
      
      setShowUploadModal(false);
    } catch (error) {
      toast({
        title: "Failed to extract questions",
        description: error instanceof Error ? error.message : "Could not process the document",
        variant: "destructive",
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Grant Form Input</h2>
          <p className="text-slate-600 mb-8">
            Enter or paste grant application questions and requirements. Our AI will generate 
            tailored responses based on your uploaded documents.
          </p>

          {/* Project Selection */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Label htmlFor="project-select" className="text-sm font-semibold text-blue-900 mb-2 block">
              Select Project
            </Label>
            <Select 
              value={currentProject || "new"} 
              onValueChange={handleProjectSelect}
            >
              <SelectTrigger id="project-select" className="bg-white">
                <SelectValue placeholder="Select an existing project or create new" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <div className="flex items-center">
                    <Plus className="mr-2 h-4 w-4 text-blue-600" />
                    <span className="font-medium">Create New Project</span>
                  </div>
                </SelectItem>
                {projects.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">
                      Existing Projects
                    </div>
                    {projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{project.title}</span>
                          <span className="text-xs text-slate-500">{project.funder}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {currentProject && (
              <p className="text-sm text-blue-700 mt-2">
                ✓ Editing existing project. Questions will be added to this project.
              </p>
            )}
            {!currentProject && (
              <p className="text-sm text-slate-600 mt-2">
                Creating a new project. Fill in the details below.
              </p>
            )}
          </div>

          {/* Form Input Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="border-2 border-primary-200 bg-primary-50">
              <CardContent className="p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                    <Keyboard className="text-white h-4 w-4" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">Manual Input</h3>
                </div>
                <p className="text-slate-600 mb-4">
                  Copy and paste questions from grant applications or enter them manually.
                </p>
                <Button 
                  className="bg-primary-600 hover:bg-primary-700 w-full"
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
              <CardContent className="p-6">
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

          {/* Grant Information Form */}
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">Grant Information</h3>
              <p className="text-sm text-slate-600 mt-1">Basic details about the grant opportunity</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Grant Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Community Health Innovation Grant"
                  value={projectForm.title}
                  onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="funder">Funding Organization</Label>
                <Input
                  id="funder"
                  placeholder="e.g., Ford Foundation"
                  value={projectForm.funder}
                  onChange={(e) => setProjectForm({ ...projectForm, funder: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Grant Amount</Label>
                <Input
                  id="amount"
                  placeholder="e.g., $150,000"
                  value={projectForm.amount}
                  onChange={(e) => setProjectForm({ ...projectForm, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Application Deadline</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={projectForm.deadline}
                  onChange={(e) => setProjectForm({ ...projectForm, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Grant Description/Guidelines</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="Paste the grant guidelines, focus areas, and requirements here..."
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
              />
            </div>
          </div>

          {/* Questions Input */}
          <div id="questions-section" className="space-y-6 mt-8">
            <div className="border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-900">Application Questions</h3>
              <p className="text-sm text-slate-600 mt-1">Add the specific questions from the grant application</p>
            </div>

            {questions.map((question, index) => (
              <Card key={question.id} className="border border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
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
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`wordLimit-${question.id}`} className="text-sm text-slate-600">
                        Word Limit:
                      </Label>
                      <Input
                        id={`wordLimit-${question.id}`}
                        type="number"
                        placeholder="500"
                        value={question.wordLimit || ""}
                        onChange={(e) => updateQuestion(question.id, 'wordLimit', parseInt(e.target.value) || null)}
                        className="w-20"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
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

          {/* Generation Settings */}
          <Card className="mt-8 bg-slate-50">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">AI Generation Settings</h3>
              
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
                          className="ml-1 p-0 h-auto text-primary-600 hover:text-primary-800"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newArea = prompt("Enter focus area:");
                        if (newArea) addFocusArea(newArea);
                      }}
                      className="inline-flex items-center px-3 py-1 text-sm"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Focus
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-slate-200">
            <Button 
              variant="outline" 
              onClick={handleSaveDraft}
              disabled={saveProjectMutation.isPending}
            >
              {saveProjectMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button 
              onClick={handleGenerateResponses}
              disabled={generateResponsesMutation.isPending || saveProjectMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {generateResponsesMutation.isPending ? "Generating..." : "Generate Responses"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clarification Panel */}
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
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Ready to Generate?</h4>
                  <p className="text-sm text-blue-700">
                    {clarificationQuestions.filter(q => q.isAnswered).length} of {clarificationQuestions.length} clarifications completed.
                    You can proceed with generation or continue answering questions.
                  </p>
                </div>
                <div className="flex space-x-3">
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
                    className="bg-blue-600 hover:bg-blue-700"
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

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-md">
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
                  <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                  <span className="text-slate-600">Processing document...</span>
                </div>
              </div>
            ) : (
              <FileUpload
                onUpload={handleUploadDocument}
                accept=".pdf,.doc,.docx"
                multiple={false}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
