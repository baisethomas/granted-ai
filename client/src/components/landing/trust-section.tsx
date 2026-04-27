import { Card, CardContent } from "@/components/ui/card";
import { Eye, LockKeyhole, Target } from "lucide-react";

export function TrustSection() {
  const trustItems = [
    {
      icon: LockKeyhole,
      title: "Private by default",
      description: "Your uploaded content is used to help your organization draft. It should not feel like a public prompt box.",
    },
    {
      icon: Eye,
      title: "Review remains yours",
      description: "Granted accelerates the first draft. Your team still owns strategy, factual accuracy, and final submission decisions.",
    },
    {
      icon: Target,
      title: "Impact stays visible",
      description: "Program details, metrics, and reporting needs stay connected to the grant work instead of scattered across files.",
    },
  ];

  return (
    <section className="border-t border-slate-200/80 bg-white py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Trust
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            Built for teams that cannot afford generic grant drafts
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Small development teams need speed, but they also need accuracy, privacy, and a
            clear review path. Granted is designed around that discipline.
          </p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {trustItems.map((item) => (
            <Card key={item.title} className="hover:shadow-md transition">
              <CardContent className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-a)] to-[var(--brand-b)] text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
