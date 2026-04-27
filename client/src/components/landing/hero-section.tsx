import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface HeroSectionProps {
  onClickSeeHow: () => void;
  onNavigateToAuth: () => void;
}

export function HeroSection({ onClickSeeHow, onNavigateToAuth }: HeroSectionProps) {
  const highlights = [
    {
      title: "Reusable memory",
      description: "Stop rebuilding the same organization context for every application.",
    },
    {
      title: "Funder alignment",
      description: "Draft against the questions, priorities, and language in each opportunity.",
    },
    {
      title: "Review-ready output",
      description: "Keep versions organized before exporting a polished draft.",
    },
  ];

  return (
    <section className="bg-white py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-6 flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-16">
        <div className="w-full lg:w-1/2">
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            AI grant drafting workspace
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
              Turn your organization's story into stronger grant drafts
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Upload past proposals, budgets, impact reports, and program materials. Granted uses that
            context to draft funder-aligned responses your team can review, revise, and export.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onNavigateToAuth}>
              Start a Draft <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={onClickSeeHow}>
              See the Workflow
            </Button>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {highlights.map((highlight) => (
              <div
                key={highlight.title}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <CheckCircle2 className="h-4 w-4 text-[var(--brand-a)]" />
                  {highlight.title}
                </div>
                <p className="mt-2 text-sm leading-5 text-slate-600">{highlight.description}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-1/2">
          <div className="relative">
            <div className="absolute inset-6 rounded-3xl bg-gradient-to-br from-[var(--brand-a)]/10 via-[var(--brand-b)]/10 to-[var(--brand-c)]/20 blur-2xl" />
            <img
              src="/generated-graphics/grant-abstract-1.png"
              alt="Illustration of a nonprofit professional reviewing grant materials"
              className="relative w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
