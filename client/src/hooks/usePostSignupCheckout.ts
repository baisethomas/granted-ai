import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { consumePendingSignupPlan } from "@/lib/signup-plan";

/**
 * After a new sign-up that chose Pro, redirect to Stripe Checkout once the
 * session is active. Starter sign-ups clear the pending flag and enter /app.
 */
export function usePostSignupCheckout(user: { id: string } | null, loading: boolean) {
  const [redirecting, setRedirecting] = useState(false);
  const checkoutStartedRef = useRef(false);

  useEffect(() => {
    if (loading || !user || checkoutStartedRef.current) return;

    const pendingPlan = consumePendingSignupPlan();
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
          checkoutStartedRef.current = false;
          setRedirecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return redirecting;
}
