import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EarlyAccessFormProps {
  /** Which landing section the signup came from — recorded server-side. */
  source: "hero" | "cta";
  className?: string;
}

export function EarlyAccessForm({ source, className }: EarlyAccessFormProps) {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const signup = useMutation({
    mutationFn: async (value: string) => {
      await apiRequest("POST", "/api/early-access", { email: value, source });
      return value;
    },
    onSuccess: (value) => setSubmittedEmail(value),
  });

  if (submittedEmail) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--brand-a)]" />
          You're on the list. We'll email {submittedEmail} when your spot opens.
        </div>
      </div>
    );
  }

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const value = email.trim();
        if (value) signup.mutate(value);
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourorganization.org"
          aria-label="Work email"
          className="h-10 bg-white"
        />
        <Button type="submit" disabled={signup.isPending} className="shrink-0">
          {signup.isPending ? "Joining…" : "Get early access"}
          {!signup.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
      {signup.isError && (
        <p className="mt-2 text-sm text-red-600">
          We couldn't add you to the list. Check the address and try again.
        </p>
      )}
    </form>
  );
}
