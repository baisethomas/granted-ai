import { Card, CardContent } from "@/components/ui/card";

export function HowItWorksSection() {
  const steps = [
    {
      step: "Step 1 — Upload Your Story",
      title: "Teach Granted your organization",
      description: "Upload your mission statement, past proposals, budgets, and impact reports. Granted learns your voice, goals, and history.",
    },
    {
      step: "Step 2 — Select or Paste a Grant",
      title: "Start from a template or your own form",
      description: "Choose from our growing template library or paste a custom application. Granted maps fields and prepares the plan.",
    },
    {
      step: "Step 3 — Let Granted Handle the Rest",
      title: "Autonomous drafting to submission-ready",
      description: "Our AI agent completes the application using your stored profile, asking only for essentials — then delivers a polished, ready-to-submit draft.",
    },
  ];

  return (
    <section id="how" className="py-12 border-t border-slate-200/80 bg-white/70">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-semibold text-slate-900">How It Works</h2>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <Card key={index} className="hover:shadow-md hover:-translate-y-0.5 transition">
              <CardContent className="p-6">
                <div className="text-slate-400 text-sm">{step.step}</div>
                <h3 className="mt-1 font-medium">{step.title}</h3>
                <p className="text-slate-600 mt-2">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}