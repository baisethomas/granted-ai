import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Shield, CheckCircle2, UploadCloud, FileText } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      icon: Sparkles,
      title: "End-to-End Agentic Writing",
      description: "Not just prompts — a fully autonomous process that completes your application start to finish.",
    },
    {
      icon: Shield,
      title: "Persistent Organizational Memory",
      description: "Granted remembers your mission and adapts over time, so every application feels tailored and authentic.",
    },
    {
      icon: CheckCircle2,
      title: "Outcome-Driven Tools",
      description: "Rubric matching, readiness checklists, and a \"Fundability Gauge\" help you submit stronger applications.",
    },
    {
      icon: UploadCloud,
      title: "Grant Discovery & Matching",
      description: "Identify the best-fit opportunities, then auto-fill them instantly with your stored profile.",
    },
    {
      icon: FileText,
      title: "Collaboration Made Easy",
      description: "Add teammates, assign sections, track edits, and export board-ready drafts.",
    },
    {
      icon: Sparkles,
      title: "Mission-Centered UX",
      description: "From a warm, human brand voice to celebratory submission moments, Granted is built for people who care about impact.",
    },
  ];

  return (
    <section className="py-12">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-semibold text-slate-900">Why Granted is Different</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="hover:shadow-md transition">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <feature.icon className="h-5 w-5 text-slate-900" />
                  <h3 className="font-medium">{feature.title}</h3>
                </div>
                <p className="text-slate-600 mt-2">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}