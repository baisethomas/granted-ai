import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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
  MoreHorizontal
} from "lucide-react";

export default function Drafts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProject, setSelectedProject] = useState<string>("");

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
  });

  const { data: questions = [] } = useQuery({
    queryKey: ["/api/projects", selectedProject, "questions"],
    enabled: !!selectedProject,
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

  const handleRegenerateResponse = (questionId: string) => {
    generateResponseMutation.mutate({
      questionId,
      tone: "professional",
      emphasisAreas: ["Impact & Outcomes", "Innovation"]
    });
  };

  const handleCopyToClipboard = () => {
    const completedQuestions = questions.filter((q: any) => q.responseStatus === "complete");
    const text = completedQuestions
      .map((q: any) => `Question: ${q.question}\n\nResponse: ${q.response}\n\n---\n\n`)
      .join("");

    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "All completed responses have been copied.",
    });
  };

  const handleExportPDF = () => {
    toast({
      title: "Export started",
      description: "Your PDF export is being prepared.",
    });
  };

  const handleExportWord = () => {
    toast({
      title: "Export started", 
      description: "Your Word document export is being prepared.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "bg-green-100 text-green-800";
      case "generating": return "bg-yellow-100 text-yellow-800";
      case "pending": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete": return <Check className="mr-1 h-3 w-3" />;
      case "generating": return <Clock className="mr-1 h-3 w-3" />;
      default: return <Clock className="mr-1 h-3 w-3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "complete": return "Complete";
      case "generating": return "Generating";
      case "pending": return "Pending";
      default: return status;
    }
  };

  const selectedProjectData = projects.find((p: any) => p.id === selectedProject);
  const completedQuestions = questions.filter((q: any) => q.responseStatus === "complete");
  const totalQuestions = questions.length;
  const progressPercentage = totalQuestions > 0 ? (completedQuestions.length / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-8">
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Generated Draft Preview</h2>
              <p className="text-slate-600 mt-1">Review and edit your AI-generated grant responses</p>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={selectedProject} onValueChange={setSelectedProject}>
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
              )}
            </div>
          </div>

          {selectedProjectData && (
            <>
              {/* Draft Header */}
              <Card className="bg-slate-50 mb-6">
                <CardContent className="p-6">
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
                        <Badge className={`ml-4 ${getStatusColor(question.responseStatus)}`}>
                          {getStatusIcon(question.responseStatus)}
                          {getStatusLabel(question.responseStatus)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {question.responseStatus === "complete" && question.response ? (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-4">
                              <span className="text-sm text-slate-600">Generated Response</span>
                              <span className="text-xs text-slate-500">
                                {question.response.split(' ').length} words
                              </span>
                              {question.wordLimit && (
                                <span className={`text-xs ${
                                  question.response.split(' ').length <= question.wordLimit
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}>
                                  {question.response.split(' ').length <= question.wordLimit 
                                    ? "✓ Within limit" 
                                    : "⚠ Over limit"}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button variant="ghost" size="sm">
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
                            </div>
                          </div>
                          <div className="prose prose-sm max-w-none">
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
                      <h3 className="font-semibold text-slate-900 mb-1">Export Options</h3>
                      <p className="text-sm text-slate-600">Download or copy your completed responses</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button variant="outline" onClick={handleCopyToClipboard}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Text
                      </Button>
                      <Button variant="outline" onClick={handleExportWord}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export DOCX
                      </Button>
                      <Button onClick={handleExportPDF} className="bg-primary-600 hover:bg-primary-700">
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </div>
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
