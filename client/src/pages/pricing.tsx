import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MarketingHeader from "@/components/layout/marketing-header";
import { getAuthUrl } from "@/lib/domains";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const plans = [
  {
    name: "Starter",
    eyebrow: "For early grant work",
    price: "Free",
    period: "",
    description: "Start organizing source material and drafting smaller applications.",
    cta: "Start Free",
    href: getAuthUrl(),
    highlighted: false,
    features: [
      "5 projects per month",
      "20 document uploads",
      "Basic draft generation",
      "Export-ready review flow",
    ],
  },
  {
    name: "Pro",
    eyebrow: "Best for active writers",
    price: "$29",
    period: "/mo",
    description: "For grant writers and consultants turning repeated context into stronger drafts.",
    cta: "Try Pro",
    href: getAuthUrl(),
    highlighted: true,
    features: [
      "Unlimited projects",
      "Unlimited document uploads",
      "Organization memory across drafts",
      "Version history and export tools",
    ],
  },
  {
    name: "Team",
    eyebrow: "For growing teams",
    price: "$49",
    period: "/mo",
    description: "Shared grant drafting for small development teams working from the same source material.",
    cta: "Start Team",
    href: getAuthUrl(),
    highlighted: false,
    features: [
      "3 team seats included",
      "Shared organization memory",
      "Project-level draft workspace",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    eyebrow: "For institutions",
    price: "Custom",
    period: "",
    description: "For organizations with larger teams, procurement needs, or custom rollout requirements.",
    cta: "Contact Sales",
    href: "mailto:sales@granted.ai",
    highlighted: false,
    features: [
      "Custom onboarding",
      "Security and procurement review",
      "Dedicated support path",
      "Roadmap and integration planning",
    ],
  },
];

const included = [
  "Private organization knowledge base",
  "Document-grounded draft generation",
  "Editable response versions",
  "Clean export workflow",
];

const faqs = [
  {
    question: "Can we start before we know which plan we need?",
    answer: "Yes. Start with the free plan, upload a small set of source materials, and test the drafting workflow before upgrading.",
  },
  {
    question: "Do plans replace our final grant review process?",
    answer: "No. Granted speeds up drafting and organization, but your team still owns final strategy, facts, and submission decisions.",
  },
  {
    question: "What happens as our document library grows?",
    answer: "Paid plans are designed around reusing organization context across more projects, uploads, and repeated grant workflows.",
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Pricing
          </div>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Simple plans for turning source material into{" "}
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
              stronger grant drafts
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Start small, then scale as your grant pipeline grows. Every plan keeps the focus
            on reusable organization memory, reviewable drafts, and clean exports.
          </p>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex h-full flex-col overflow-hidden bg-white transition hover:-translate-y-0.5 hover:shadow-lg ${
                plan.highlighted
                  ? "border-[var(--brand-a)] shadow-xl ring-4 ring-[var(--brand-a)]/10"
                  : "border-slate-200 shadow-sm"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute right-5 top-5 rounded-full bg-gradient-to-r from-[var(--brand-a)] to-[var(--brand-b)] px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </div>
              )}
              <CardContent className={`flex h-full flex-col p-6 ${plan.highlighted ? "pt-16" : ""}`}>
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  {plan.eyebrow}
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">{plan.name}</h2>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="pb-1 text-sm font-medium text-slate-500">{plan.period}</span>
                  )}
                </div>
                <p className="mt-4 min-h-20 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>
                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-a)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a href={plan.href} className="mt-8 block">
                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Included
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
              Pricing should be easy to evaluate.
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              The plan choice should come down to volume and team needs, not whether you get
              the core drafting workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {included.map((item) => (
              <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-3 font-semibold text-slate-900">
                  <CheckCircle2 className="h-5 w-5 text-[var(--brand-a)]" />
                  {item}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Common pricing questions
            </h2>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {faqs.map((faq) => (
              <Card key={faq.question} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-slate-900">{faq.question}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
              Build your organization memory once. Use it across every draft.
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-lg leading-8 text-slate-600">
            Start free today, then upgrade when your grant workload needs more projects,
            uploads, or team capacity.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href={getAuthUrl()}>
              <Button>
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href="mailto:sales@granted.ai">
              <Button variant="outline">Contact Sales</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
