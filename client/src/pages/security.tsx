import { useEffect } from "react";
import MarketingHeader from "@/components/layout/marketing-header";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthUrl } from "@/lib/domains";
import {
  ArrowRight,
  Building2,
  FileUp,
  KeyRound,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Ban,
} from "lucide-react";

const PAGE_TITLE = "Security | Granted";
const PAGE_DESCRIPTION =
  "How Granted keeps your organization's documents scoped to your account — and what happens when you upload and generate a draft.";

const pillars = [
  {
    icon: Building2,
    title: "Org-scoped access",
    description:
      "Documents, drafts, and org details stay in your workspace. App data APIs require sign-in, and access follows organization membership.",
  },
  {
    icon: Sparkles,
    title: "Honest draft processing",
    description:
      "Upload and generation may send relevant text to OpenAI's API to summarize, embed, and draft. That data is not used to train models by default.",
  },
  {
    icon: ShieldCheck,
    title: "Hardened by default",
    description:
      "API keys stay on the server. API responses include standard security headers. Data is encrypted in transit and at rest.",
  },
  {
    icon: Ban,
    title: "Clear boundaries",
    description:
      "We don't sell your personal information or train foundation models on your content. We won't claim certifications we haven't earned.",
  },
];

const flowSteps = [
  {
    icon: FileUp,
    title: "Upload",
    description: "Source materials go into your organization's workspace.",
  },
  {
    icon: Search,
    title: "Prepare",
    description:
      "Document text may be summarized and embedded via OpenAI so relevant passages can be found later.",
  },
  {
    icon: Sparkles,
    title: "Generate",
    description:
      "For a draft, Granted retrieves the best passages and sends those excerpts to OpenAI's API.",
  },
  {
    icon: LockKeyhole,
    title: "Stay yours",
    description: "Answers, citations, and versions save back to your organization.",
  },
];

const hardenItems = [
  {
    icon: KeyRound,
    title: "Sign-in required",
    description: "App data APIs require a signed-in account.",
  },
  {
    icon: LockKeyhole,
    title: "Keys stay server-side",
    description: "OpenAI API keys are not shipped to the browser.",
  },
  {
    icon: ShieldCheck,
    title: "Security headers",
    description: "API responses include HSTS and a content security policy.",
  },
  {
    icon: ShieldCheck,
    title: "Encrypted data",
    description: "Data is encrypted in transit and at rest.",
  },
];

export default function Security() {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionMeta?.getAttribute("content") ?? "";

    document.title = PAGE_TITLE;
    descriptionMeta?.setAttribute("content", PAGE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      descriptionMeta?.setAttribute("content", previousDescription);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <MarketingHeader />

      <section className="bg-white py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Security
          </div>
          <h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Your org&apos;s documents{" "}
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
              stay yours
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            How Granted scopes access, handles uploads and drafting, and hardens the app — built for
            teams that need speed without giving up trust.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <a href={getAuthUrl("starter")}>
                Start free <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="mailto:support@grantedai.app?subject=Security%20or%20procurement%20question">
                Talk to us about security
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Built in
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Trust features, not fine print
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              The same disciplines that make drafts reviewable also keep your materials where they
              belong.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {pillars.map((pillar) => (
              <Card
                key={pillar.title}
                className="border-slate-200 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-a)] to-[var(--brand-b)] text-white">
                    <pillar.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-semibold text-slate-900">{pillar.title}</h3>
                  <p className="mt-2 leading-7 text-slate-600">{pillar.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-gradient-to-b from-slate-50 to-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              How it works
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              From upload to draft — still your org&apos;s data
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              OpenAI&apos;s API does not use that data to train its models by default. Granted does not
              use your content to train models.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-a)]/10 text-[var(--brand-a)]">
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-white py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl">
            <div className="text-sm font-semibold uppercase tracking-widest text-slate-500">
              Hardening
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Practical controls on every request
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {hardenItems.map((item) => (
              <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                <item.icon className="h-5 w-5 text-[var(--brand-a)]" />
                <h3 className="mt-4 font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/80 bg-gradient-to-br from-[var(--brand-a)]/5 via-white to-[var(--brand-c)]/10 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Evaluating Granted for procurement?
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Email{" "}
              <a
                href="mailto:support@grantedai.app"
                className="font-medium text-[var(--brand-a)] underline-offset-4 hover:underline"
              >
                support@grantedai.app
              </a>{" "}
              with security questions, or review plans on our pricing page.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <a href="mailto:support@grantedai.app?subject=Security%20or%20procurement%20question">
                  Contact support
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="/pricing">View pricing</a>
              </Button>
            </div>
            <p className="mt-10 text-sm text-slate-500">
              Related:{" "}
              <a href="/privacy" className="underline-offset-4 hover:underline">
                Privacy Policy
              </a>
              {" · "}
              <a href="/terms" className="underline-offset-4 hover:underline">
                Terms of Service
              </a>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
