import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { resolvePendingSignupPlan, setPendingSignupPlan } from "@/lib/signup-plan";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

async function clearSignupPlanMetadata(): Promise<void> {
  await supabase.auth.updateUser({ data: { signup_plan: null } });
}

/**
 * After a new sign-up that chose Pro, redirect to Stripe Checkout once the
 * session is active. Starter sign-ups clear the pending flag and enter /app.
 */
export function usePostSignupCheckout(user: User | null, loading: boolean) {
  const [redirecting, setRedirecting] = useState(false);
  const checkoutStartedRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    if (loading || !user || checkoutStartedRef.current) return;

    const pendingPlan = resolvePendingSignupPlan(user);
    if (!pendingPlan) return;

    // Clear metadata whenever a plan is resolved so stale signup_plan cannot
    // re-trigger checkout after sessionStorage is gone (e.g. Stripe redirect).
    void clearSignupPlanMetadata();

    if (pendingPlan !== "pro") return;

    checkoutStartedRef.current = true;
    let cancelled = false;
    setRedirecting(true);

    (async () => {
      try {
        const checkout = await api.createProCheckout();
        if (cancelled) return;
        if (!checkout.url) {
          throw new Error("Checkout URL was not returned");
        }
        window.location.href = checkout.url;
      } catch (error) {
        console.error("Post-signup checkout failed:", error);
        if (!cancelled) {
          setPendingSignupPlan("pro");
          checkoutStartedRef.current = false;
          setRedirecting(false);
          toast({
            title: "Checkout unavailable",
            description: "Continue to Pro checkout from Pricing or Settings when you're ready.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, toast]);

  return redirecting;
}
