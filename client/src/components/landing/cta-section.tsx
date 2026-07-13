import { Button } from "@/components/ui/button";
import { EarlyAccessForm } from "./early-access-form";

interface CTASectionProps {
  onLogin: () => void;
}

export function CTASection({ onLogin }: CTASectionProps) {
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
          Join the list and we'll email your invite as spots open. Already have an
          account? Log in.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <EarlyAccessForm source="cta" className="flex justify-center" />
          <Button variant="outline" onClick={onLogin}>
            Log in
          </Button>
        </div>
      </div>
    </section>
  );
}
