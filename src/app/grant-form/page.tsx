"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { ClarificationPanel } from "@/components/clarifications/ClarificationPanel";
import { AssumptionHighlighter } from "@/components/clarifications/AssumptionHighlighter";
import type { ClarificationSession } from "@/lib/clarifications/types";

export default function GrantFormPage() {
  const [questionsText, setQuestionsText] = useState("");
  const documents = useAppStore((s) => s.documents);
  const tone = useAppStore((s) => s.tone);
  const setDraft = useAppStore((s) => s.setDraft);
  const [loading, setLoading] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState("");
  const [clarificationSession, setClarificationSession] = useState<ClarificationSession | null>(null);
  const [step, setStep] = useState<'questions' | 'clarifications' | 'results'>('questions');

  const questions = questionsText
    .split(/\n+/)
    .map((q) => q.trim())
    .filter(Boolean);

  const contextMemory = documents.map((d) => `# ${d.name}\n${d.summary ?? ""}`).join("\n\n");

  const handleAnalyzeClarifications = () => {
    if (questions.length === 0) return;
    setStep('clarifications');
  };

  const handleClarificationsComplete = async (enhancedContext: string, session: ClarificationSession) => {
    setClarificationSession(session);
    await generateWithContext(enhancedContext);
  };

  const handleSkipClarifications = async () => {
    await generateWithContext(contextMemory);
  };

  const generateWithContext = async (context: string) => {
    setLoading(true);
    setStep('results');
    
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          questions, 
          contextMemory: context, 
          tone,
          useRAG: true,
          organizationId: "default" // TODO: Get actual organization ID
        }),
      });
      const data = await res.json();
      const draft = data?.draft ?? "";
      setDraft(draft);
      setGeneratedDraft(draft);
    } catch (error) {
      console.error('Error generating draft:', error);
    } finally {
      setLoading(false);
    }
  };

  const onGenerate = () => {
    handleAnalyzeClarifications();
  };

  const renderStep = () => {
    switch (step) {
      case 'questions':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Funder Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-black/70">
                Paste questions, one per line. We will analyze for missing information and help strengthen your responses.
              </div>
              <Textarea
                placeholder={"What is your organization's mission?\nDescribe the target population...\nProvide your evaluation plan..."}
                value={questionsText}
                onChange={(e) => setQuestionsText(e.target.value)}
                className="min-h-[200px]"
              />
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-500">
                  {questions.length} question{questions.length !== 1 ? 's' : ''} detected
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleSkipClarifications} 
                    disabled={loading || questions.length === 0}
                  >
                    Skip Analysis
                  </Button>
                  <Button 
                    onClick={onGenerate} 
                    disabled={loading || questions.length === 0}
                  >
                    {loading ? "Analyzing…" : "Analyze & Generate"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'clarifications':
        return (
          <ClarificationPanel
            grantQuestions={questions}
            organizationId="default" // TODO: Get actual organization ID
            existingContext={contextMemory}
            tone={tone}
            onClarificationsComplete={handleClarificationsComplete}
            onSkip={handleSkipClarifications}
          />
        );

      case 'results':
        return (
          <div className="space-y-6">
            {/* Generation status */}
            {loading && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="py-6">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                    <div>
                      <h3 className="font-medium text-blue-900">
                        Generating Enhanced Grant Responses
                      </h3>
                      <p className="text-sm text-blue-700">
                        {clarificationSession ? 
                          `Using ${clarificationSession.answers.length} clarifying answers to improve quality...` :
                          'Generating responses with available context...'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generated content with assumption detection */}
            {generatedDraft && !loading && (
              <AssumptionHighlighter
                generatedText={generatedDraft}
                grantQuestions={questions}
                organizationId="default"
                existingContext={contextMemory}
              />
            )}

            {/* Session summary */}
            {clarificationSession && !loading && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="text-green-800">
                    Clarification Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-medium text-green-800">Questions Asked</div>
                      <div className="text-green-700">{clarificationSession.questions.length}</div>
                    </div>
                    <div>
                      <div className="font-medium text-green-800">Answers Provided</div>
                      <div className="text-green-700">{clarificationSession.answers.length}</div>
                    </div>
                    <div>
                      <div className="font-medium text-green-800">Completion Rate</div>
                      <div className="text-green-700">{Math.round(clarificationSession.completionRate * 100)}%</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => {
                  setStep('questions');
                  setGeneratedDraft('');
                  setClarificationSession(null);
                }}
              >
                Start Over
              </Button>
              <Button 
                onClick={() => {
                  setStep('clarifications');
                }}
                disabled={loading}
              >
                Refine Further
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Grant Form</h1>
        {step !== 'questions' && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className={step === 'questions' ? 'font-medium text-blue-600' : ''}>Questions</div>
            <span>→</span>
            <div className={step === 'clarifications' ? 'font-medium text-blue-600' : ''}>Analysis</div>
            <span>→</span>
            <div className={step === 'results' ? 'font-medium text-blue-600' : ''}>Results</div>
          </div>
        )}
      </div>

      {renderStep()}
    </div>
  );
}