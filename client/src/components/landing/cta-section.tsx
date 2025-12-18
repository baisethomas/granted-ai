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
        <div className="text-sm uppercase tracking-widest text-slate-500">Ready to Win More Grants?</div>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-[var(--brand-a)] via-[var(--brand-b)] to-[var(--brand-c)] bg-clip-text text-transparent">
            Win more grants. Spend less time writing.
          </span>
        </h2>
        <p className="text-slate-600 mt-3 text-lg">
          Whether you're applying for your first grant or your hundredth, Granted helps you work smarter, 
          move faster, and focus on your mission.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={onSignup}>
            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onLogin}>
            Log in
          </Button>
        </div>
      </div>
    </section>
  );
}