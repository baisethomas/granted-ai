import { Card, CardContent } from "@/components/ui/card";

export function HowItWorksSection() {
  const steps = [
    {
      step: "Step 1",
      title: "Upload your source materials",
      description: "Add mission statements, prior proposals, budgets, bios, impact reports, and program notes.",
      image: "/generated-graphics/onboarding-upload.svg",
    },
    {
      step: "Step 2",
      title: "Add grant questions",
      description: "Paste questions or upload an application so Granted can map each response to the funder's ask.",
      image: "/generated-graphics/onboarding-questions.svg",
    },
    {
      step: "Step 3",
      title: "Generate a draft",
      description: "Produce tailored answers using your stored context, with less blank-page writing and rework.",
      image: "/generated-graphics/onboarding-drafts.svg",
    },
    {
      step: "Step 4",
      title: "Review and export",
      description: "Revise, select the current version, and export a clean application draft for final submission review.",
      image: "/generated-graphics/onboarding-impact.svg",
    },
  ];

  return (
    <section id="how" className="border-t border-slate-200/80 bg-white py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Workflow
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Move from source material to stronger first draft
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Granted is built around the work grant teams already do: collecting evidence, answering
            funder questions, reviewing language, and preparing clean exports.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Card key={index} className="hover:shadow-md hover:-translate-y-0.5 transition">
              <CardContent className="p-6">
                <img src={step.image} alt="" className="h-28 w-full object-contain" />
                <div className="mt-5 text-xs font-semibold uppercase tracking-widest text-[var(--brand-a)]">
                  {step.step}
                </div>
                <h3 className="mt-2 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
