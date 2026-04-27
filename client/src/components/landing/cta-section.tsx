import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface CTASectionProps {
  onSignup: () => void;
  onLogin: () => void;
}

export function CTASection({ onSignup, onLogin }: CTASectionProps) {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <div className="text-sm uppercase tracking-widest text-slate-500">
          Ready when the next grant opens
        </div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
            Build your organization memory once. Use it across every draft.
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-3xl text-lg leading-8 text-slate-600">
          Start with your existing materials and turn the next application into a focused
          review process instead of a blank-page scramble.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={onSignup}>
            Start a Draft <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onLogin}>
            Log in
          </Button>
        </div>
      </div>
    </section>
  );
}
