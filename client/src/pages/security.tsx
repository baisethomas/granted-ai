import MarketingHeader from "@/components/layout/marketing-header";
import { Footer } from "@/components/landing/footer";
import { Button } from "@/components/ui/button";
import { getAuthUrl } from "@/lib/domains";

export default function Security() {
  const lastUpdated = "July 28, 2026";

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(105deg, #f9fafb 0%, #eef2f7 80%, #f6ede7 100%)" }}
    >
      <MarketingHeader />
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <span className="inline-block mb-4 rounded-lg border border-white/10 px-3 py-1">
            <span className="uppercase tracking-widest text-xs font-bold text-blue-500">Security</span>
          </span>
          <h1 className="mb-4 text-gray-900 font-normal leading-tight tracking-tight text-4xl sm:text-5xl">
            Your org&apos;s documents stay yours
          </h1>
          <p className="text-lg text-slate-600 mb-6">
            Here&apos;s how Granted scopes access, handles draft generation, and protects the app — in
            plain language.
          </p>
          <p className="text-sm text-slate-500 mb-8">Last updated: {lastUpdated}</p>

          <div className="flex flex-wrap gap-3 mb-12">
            <Button asChild>
              <a href={getAuthUrl("starter")}>Start free</a>
            </Button>
            <Button asChild variant="outline">
              <a href="mailto:support@grantedai.app?subject=Security%20or%20procurement%20question">
                Contact us
              </a>
            </Button>
          </div>

          <div className="prose prose-slate max-w-none bg-white/80 rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8 text-slate-700">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900 !mt-0">Who can access your data</h2>
              <p>
                Your documents, drafts, and organization details live inside your organization&apos;s
                workspace. App data APIs require a signed-in account, and access is scoped to
                organization membership — another organization&apos;s account cannot open yours.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">What happens when you generate a draft</h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>You upload source materials to your organization.</li>
                <li>Granted retrieves the passages most relevant to the question.</li>
                <li>Those excerpts are sent to OpenAI&apos;s API to draft an answer.</li>
                <li>The answer, citations, and versions are saved back to your organization.</li>
              </ol>
              <p>
                OpenAI&apos;s API does not use that data to train its models by default. Granted does not
                use your content to train models.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">How we harden the app</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Sign-in through Supabase Auth for app access</li>
                <li>OpenAI API keys stay on the server — they are not shipped to the browser</li>
                <li>
                  Production responses include standard browser security headers (including HSTS and a
                  content security policy)
                </li>
                <li>
                  Data is stored with infrastructure providers that encrypt data at rest (AES-256) and
                  encrypt traffic in transit (TLS/HTTPS): Neon (database), Supabase (auth and files),
                  and Vercel (application)
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">What we don&apos;t do</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>We do not sell your personal information</li>
                <li>We do not use your content to train foundation models</li>
                <li>
                  We do not claim certifications we haven&apos;t earned — if you need a formal security
                  review for procurement, email us
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Security and procurement questions</h2>
              <p>
                Evaluating Granted for a larger rollout? Email{" "}
                <a href="mailto:support@grantedai.app" className="text-blue-600 underline">
                  support@grantedai.app
                </a>{" "}
                with security or procurement questions. You can also see plans on our{" "}
                <a href="/pricing" className="text-blue-600 underline">
                  pricing page
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-slate-900">Related policies</h2>
              <p>
                See also our{" "}
                <a href="/privacy" className="text-blue-600 underline">
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a href="/terms" className="text-blue-600 underline">
                  Terms of Service
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
