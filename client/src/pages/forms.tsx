import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Keyboard, 
  FileUp, 
  Plus,
  Trash2,
  Wand2,
  X
} from "lucide-react";

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

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

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

  const createQuestionMutation = useMutation({
    mutationFn: ({ projectId, question }: { projectId: string; question: any }) =>
      api.createQuestion(projectId, question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const generateResponsesMutation = useMutation({
    mutationFn: async (projectId: string) => {
      // Create project first if needed
      let pid = projectId;
      if (!pid) {
        const project = await api.createProject(projectForm);
        pid = project.id;
        setCurrentProject(pid);
      }

      // Create questions
      for (const q of questions) {
        await api.createQuestion(pid, {
          question: q.question,
          wordLimit: q.wordLimit || undefined,
          priority: q.priority,
        });
      }

      return pid;
    },
    onSuccess: (projectId) => {
      toast({
        title: "Responses generating",
        description: "AI is generating responses for your questions.",
      });
      // Navigate to drafts view would go here
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
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleProjectSubmit = () => {
    if (!projectForm.title || !projectForm.funder) {
      toast({
        title: "Missing information",
        description: "Please fill in the project title and funder.",
        variant: "destructive",
      });
      return;
    }

    createProjectMutation.mutate(projectForm);
  };

  const handleGenerateResponses = () => {
    if (questions.length === 0) {
      toast({
        title: "No questions added",
        description: "Please add at least one question before generating responses.",
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

  return (
    <div className="space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Grant Form Input</h2>
          <p className="text-slate-600 mb-8">
            Enter or paste grant application questions and requirements. Our AI will generate 
            tailored responses based on your uploaded documents.
          </p>

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
                <Button className="bg-primary-600 hover:bg-primary-700 w-full">
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
                <Button variant="outline" className="w-full">
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
          <div className="space-y-6 mt-8">
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
            <Button variant="outline" onClick={handleProjectSubmit}>
              Save Draft
            </Button>
            <Button 
              onClick={handleGenerateResponses}
              disabled={generateResponsesMutation.isPending}
              className="bg-primary-600 hover:bg-primary-700"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {generateResponsesMutation.isPending ? "Generating..." : "Generate Responses"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
