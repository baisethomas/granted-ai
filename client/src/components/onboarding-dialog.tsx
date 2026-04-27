import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileQuestion, FolderUp, Sparkles, Target } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONBOARDING_STORAGE_KEY = "granted:onboarding:v1";

type OnboardingDialogProps = {
  onNavigate: (tab: string) => void;
};

const steps = [
  {
    title: "Welcome to Granted",
    description: "Turn your source material, grant questions, and program details into stronger first drafts with a clear review flow.",
    image: "/generated-graphics/onboarding-discover.svg",
    icon: Sparkles,
    action: "Start tour",
    tab: "dashboard",
  },
  {
    title: "Upload your source material",
    description: "Add strategic plans, budgets, prior applications, reports, and RFPs so drafts can pull from the right context.",
    image: "/generated-graphics/onboarding-upload.svg",
    icon: FolderUp,
    action: "Go to uploads",
    tab: "upload",
  },
  {
    title: "Add grant questions",
    description: "Create an application form from funder prompts, then attach the documents and project context that matter.",
    image: "/generated-graphics/onboarding-questions.svg",
    icon: FileQuestion,
    action: "Open forms",
    tab: "forms",
  },
  {
    title: "Generate and refine drafts",
    description: "Review AI-assisted responses, check citations, and export polished answers when your team is ready.",
    image: "/generated-graphics/onboarding-drafts.svg",
    icon: Check,
    action: "View drafts",
    tab: "drafts",
  },
  {
    title: "Track outcomes",
    description: "Use project and portfolio metrics to keep grant work connected to program impact and reporting needs.",
    image: "/generated-graphics/onboarding-impact.svg",
    icon: Target,
    action: "Finish",
    tab: "metrics",
  },
];

export function OnboardingDialog({ onNavigate }: OnboardingDialogProps) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const activeStep = steps[stepIndex];
  const isFinalStep = stepIndex === steps.length - 1;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "done");
  }, []);

  const progressLabel = useMemo(
    () => `${stepIndex + 1} of ${steps.length}`,
    [stepIndex],
  );

  const finish = () => {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    setOpen(false);
  };

  const handlePrimaryAction = () => {
    if (isFinalStep) {
      finish();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleExplore = () => {
    onNavigate(activeStep.tab);
    finish();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "done");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[920px] overflow-hidden p-0 sm:rounded-lg">
        <div className="grid min-h-[560px] md:grid-cols-[1.08fr_.92fr]">
          <div className="relative flex min-h-[260px] items-center justify-center overflow-hidden bg-[#fff8e7] p-8">
            <img
              src={activeStep.image}
              alt=""
              className="h-full max-h-[440px] w-full max-w-[440px] object-contain"
            />
          </div>

          <div className="flex flex-col p-6 sm:p-8">
            <DialogHeader className="space-y-4 text-left">
              <div className="flex items-center justify-between pr-8">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-amber-100 text-slate-900">
                  <activeStep.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-slate-500">{progressLabel}</span>
              </div>
              <div className="space-y-3">
                <DialogTitle className="text-2xl leading-tight text-slate-950">
                  {activeStep.title}
                </DialogTitle>
                <DialogDescription className="text-base leading-7 text-slate-600">
                  {activeStep.description}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="mt-8 flex gap-2">
              {steps.map((step, index) => (
                <button
                  key={step.title}
                  type="button"
                  aria-label={`Go to onboarding step ${index + 1}`}
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    "h-2 flex-1 rounded-full bg-slate-200 transition-colors",
                    index <= stepIndex && "bg-amber-400",
                  )}
                />
              ))}
            </div>

            <div className="mt-auto pt-8">
              <div className="grid grid-cols-5 gap-2">
                {steps.map((step, index) => (
                  <button
                    key={step.image}
                    type="button"
                    onClick={() => setStepIndex(index)}
                    className={cn(
                      "aspect-square overflow-hidden rounded-md border bg-white p-1 transition",
                      index === stepIndex ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200 hover:border-slate-300",
                    )}
                    aria-label={`Preview ${step.title}`}
                  >
                    <img src={step.image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="ghost" onClick={handleExplore}>
                  {activeStep.action}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setStepIndex((current) => Math.max(current - 1, 0))}
                    disabled={stepIndex === 0}
                    aria-label="Previous onboarding step"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button onClick={handlePrimaryAction}>
                    {isFinalStep ? "Done" : "Next"}
                    {!isFinalStep && <ArrowRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
