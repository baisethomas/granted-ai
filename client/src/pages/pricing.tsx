import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import MarketingHeader from "@/components/layout/marketing-header";

export default function Pricing() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(105deg, #f9fafb 0%, #eef2f7 80%, #f6ede7 100%)" }}
    >
      <MarketingHeader />
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <span className="inline-block mb-4 rounded-lg border border-white/10 px-3 py-1">
            <span className="uppercase tracking-widest text-xs font-bold text-blue-500">Pricing</span>
          </span>
          <h1 className="mb-4 text-gray-900 font-normal leading-tight tracking-tight text-4xl sm:text-5xl">
            Find the <span className="bg-gradient-to-r from-[var(--brand-b)] to-[var(--brand-a)] bg-clip-text text-transparent">perfect plan</span> for you
          </h1>
          <h2 className="text-lg font-normal mb-6 text-gray-700">
            Choose from flexible plans designed to accelerate your projects with powerful AI features.
          </h2>
        </div>
      </section>

      {/* App-specific four-plan layout */}
      <section className="w-full px-6 pb-4 -mt-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {/* Starter */}
          <div className="bg-white/90 rounded-2xl shadow-lg border border-gray-100 px-7 py-8 flex flex-col">
            <span className="mb-2 uppercase text-xs tracking-wider font-semibold text-blue-500">Starter</span>
            <div className="flex items-end mb-3">
              <span className="text-5xl font-bold text-gray-900">Free</span>
            </div>
            <p className="mb-5 text-gray-600">Small teams starting their grant journey.</p>
            <ul className="mb-7 space-y-2 text-sm">
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> 5 projects / month</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> 20 uploads</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Basic agentic writing</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Community support</li>
            </ul>
            <a href="/auth" className="mt-auto inline-block rounded-lg px-6 py-3 font-bold text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition focus:outline-none focus:ring-4 focus:ring-blue-200 text-center shadow">Get Started</a>
          </div>

          {/* Pro */}
          <div className="relative bg-white/95 rounded-2xl shadow-2xl border-2 border-purple-300 px-7 py-10 flex flex-col md:scale-105">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 px-4 py-1 bg-purple-500 text-white text-xs rounded-full font-semibold shadow">Most Popular</span>
            <span className="mb-2 uppercase text-xs tracking-wider font-semibold text-purple-600">Pro</span>
            <div className="flex items-end mb-3">
              <span className="text-5xl font-bold text-gray-900">$29</span>
              <span className="ml-1 text-base text-gray-500 font-medium">/mo or $290/yr</span>
            </div>
            <p className="mb-5 text-gray-700">Grant writers who want full power.</p>
            <ul className="mb-7 space-y-2 text-sm">
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Unlimited projects & uploads</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Full agentic assistant</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Rubric scoring & Fundability Gauge</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Email support</li>
            </ul>
            <a href="/auth" className="mt-auto inline-block rounded-lg px-6 py-3 font-bold text-white bg-purple-600 hover:bg-purple-700 active:bg-purple-800 transition focus:outline-none focus:ring-4 focus:ring-purple-200 text-center shadow-lg">Try Pro</a>
          </div>

          {/* Team */}
          <div className="bg-white/95 rounded-2xl shadow-lg border border-indigo-200 px-7 py-8 flex flex-col">
            <span className="mb-2 uppercase text-xs tracking-wider font-semibold text-indigo-600">Team</span>
            <div className="flex items-end mb-3">
              <span className="text-5xl font-bold text-gray-900">$49</span>
              <span className="ml-1 text-base text-gray-500 font-medium">/mo (3 users) or $490/yr</span>
            </div>
            <p className="mb-5 text-gray-700">Collaboration tools for small to mid-size teams.</p>
            <ul className="mb-7 space-y-2 text-sm">
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> All Pro features</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Shared org memory</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Collaboration tools, roles & permissions</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Priority support</li>
            </ul>
            <a href="/auth" className="mt-auto inline-block rounded-lg px-6 py-3 font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition focus:outline-none focus:ring-4 focus:ring-indigo-200 text-center shadow">Start Team</a>
          </div>

          {/* Enterprise */}
          <div className="bg-white/90 rounded-2xl shadow-lg border border-gray-100 px-7 py-8 flex flex-col">
            <span className="mb-2 uppercase text-xs tracking-wider font-semibold text-orange-600">Enterprise</span>
            <div className="flex items-end mb-3">
              <span className="text-2xl font-semibold text-gray-900">Custom Quote</span>
            </div>
            <p className="mb-5 text-gray-600">Advanced needs for large institutions.</p>
            <ul className="mb-7 space-y-2 text-sm">
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> All Team features</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> API access & SSO</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Compliance add-ons</li>
              <li className="flex items-center"><IconCheck className="text-green-500 mr-2" /> Dedicated onboarding & support</li>
            </ul>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Sales contact coming soon"); }} className="mt-auto inline-block rounded-lg px-6 py-3 font-bold text-white bg-orange-500 hover:bg-orange-600 active:bg-orange-700 transition focus:outline-none focus:ring-4 focus:ring-orange-200 text-center shadow">Contact Sales</a>
          </div>
        </div>
      </section>

      {/* Tier details */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <DetailCard
            title="Starter — $0/month"
            bullets={[
              "5 projects per month",
              "20 document uploads",
              "Basic agentic grant writing (limited usage)",
              "Community-based support",
            ]}
            intro="Perfect for small teams just beginning their grant journey."
          />
          <DetailCard
            title="Pro — $29/month (or $290/year)"
            bullets={[
              "Unlimited projects & uploads",
              "Full agentic assistant with minimal clarifications",
              "Rubric scoring tools & Fundability Gauge",
              "Email support",
            ]}
            intro="Full power for dedicated grant writers and consultants. Includes everything in Starter, plus:"
          />
          <DetailCard
            title="Team — $49/month for 3 users (or $490/year)"
            bullets={[
              "Shared organizational memory database",
              "Multi-user roles and permissions",
              "Inline commenting & version history",
              "Priority support",
            ]}
            intro="Collaboration tools for growing teams. Includes everything in Pro, plus:"
          />
          <DetailCard
            title="Enterprise — Custom Pricing"
            bullets={[
              "API access for integrations",
              "Single Sign-On (SSO)",
              "SOC 2 & security add-ons",
              "Dedicated onboarding specialist",
              "SLA-backed priority support",
            ]}
            intro="Enterprise-grade features for institutions, universities, and multi-department organizations. Includes everything in Team, plus:"
          />
        </div>
      </section>

      {/* Add-ons */}
      <section className="py-12 bg-[var(--accent)]/40">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Credit Packs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">10k tokens / 100 queries for $10</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Overage</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">$0.10 per 1k tokens beyond plan limits</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Volume Discounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">For high-usage organizations</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">Ready to write less and win more?</span>
          </h2>
          <p className="text-slate-600 mt-3 text-lg">Start free today — upgrade only when you’re ready for more power.</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a href="/auth"><Button>Get Started Free</Button></a>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Demo booking coming soon"); }}>
              <Button variant="outline">Book a Demo</Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanCard({ name, price, tagline, features, ctaLabel, highlight }: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  ctaLabel: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`${highlight ? "border-[var(--brand-a)] shadow-md" : ""}`}>
      <CardHeader>
        <CardTitle className="text-xl">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-2xl font-extrabold">{price}</div>
        <div className="text-slate-600 text-sm">{tagline}</div>
        <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <a href="/auth">
          <Button className={`${highlight ? "bg-[var(--brand-a)] hover:bg-[color-mix(in_srgb,var(--brand-a) 85%,black)]" : ""} w-full`}>{ctaLabel}</Button>
        </a>
      </CardContent>
    </Card>
  );
}

function DetailCard({ title, intro, bullets }: { title: string; intro: string; bullets: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-slate-700">{intro}</p>
        <ul className="mt-3 text-slate-700 space-y-1 list-disc pl-5">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}


