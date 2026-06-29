import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import {
  clearSignupPlanMetadata,
  resolvePendingSignupPlan,
  setPendingSignupPlan,
} from "@/lib/signup-plan";
import { useToast } from "@/hooks/use-toast";

/**
 * After a new sign-up that chose Pro, redirect to Stripe Checkout once the
 * session is active. Starter sign-ups clear the pending flag and enter /app.
 */
export function usePostSignupCheckout(user: User | null, loading: boolean) {
  const [redirecting, setRedirecting] = useState(false);
  const checkoutStartedRef = useRef(false);
  const userRef = useRef(user);
  userRef.current = user;
  const { toast } = useToast();
  const userId = user?.id ?? null;

  useEffect(() => {
    const currentUser = userRef.current;
    if (loading || !currentUser || checkoutStartedRef.current) return;

    const pendingPlan = resolvePendingSignupPlan(currentUser);
    if (!pendingPlan) return;

    if (pendingPlan !== "pro") {
      void clearSignupPlanMetadata();
      return;
    }

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
        // Defer metadata cleanup until checkout is ready so updateUser() does not
        // emit USER_UPDATED and replace `user` while this effect is in flight.
        await clearSignupPlanMetadata();
        if (cancelled) return;
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
    // Key on user id only — metadata-only updates must not re-run or cancel checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user read inside effect; userId avoids metadata churn
  }, [userId, loading]);

  return redirecting;
}
