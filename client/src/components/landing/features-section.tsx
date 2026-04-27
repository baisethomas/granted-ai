import { Card, CardContent } from "@/components/ui/card";
import { Archive, FileCheck2, GitBranch } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      icon: Archive,
      title: "Organization memory",
      description: "Granted keeps your mission, programs, budgets, staff experience, and past proposal language available across applications.",
    },
    {
      icon: FileCheck2,
      title: "Source-grounded drafting",
      description: "Drafts are based on the material you provide, so claims and details are easier for your team to verify.",
    },
    {
      icon: GitBranch,
      title: "Versioned review",
      description: "Keep iterations organized as your team edits language, updates metrics, and selects the final response.",
    },
  ];

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-16">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative">
          <div className="absolute inset-8 rounded-3xl bg-gradient-to-br from-[var(--brand-a)]/10 via-[var(--brand-b)]/10 to-[var(--brand-c)]/20 blur-2xl" />
          <img
            src="/generated-graphics/grant-abstract-3.png"
            alt="Illustration of organized grant documents and extracted source material"
            className="relative w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
          />
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Why it works
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
              Less generic AI. More usable grant material.
            </span>
          </h2>
          <div className="mt-8 grid gap-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-slate-200 bg-white/90 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <feature.icon className="h-5 w-5 text-[var(--brand-a)]" />
                    <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                  </div>
                  <p className="mt-2 leading-7 text-slate-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
