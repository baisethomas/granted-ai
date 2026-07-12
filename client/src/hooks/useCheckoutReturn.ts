import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, type OrganizationBillingUsage } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { useToast } from "@/hooks/use-toast";

const POLL_ATTEMPTS = 15;
const POLL_INTERVAL_MS = 1_000;

export async function waitForProPlan({
  getBilling,
  wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  attempts = POLL_ATTEMPTS,
}: {
  getBilling: () => Promise<OrganizationBillingUsage>;
  wait?: (milliseconds: number) => Promise<unknown>;
  attempts?: number;
}): Promise<OrganizationBillingUsage | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const billing = await getBilling();
      if (
        billing.plan === "pro" &&
        (billing.status === "active" || billing.status === "trialing")
      ) return billing;
    } catch {
      // Webhook propagation and short-lived network errors are both retried.
    }
    if (attempt < attempts - 1) await wait(POLL_INTERVAL_MS);
  }
  return null;
}

function removeCheckoutParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("checkout");
  url.searchParams.delete("organizationId");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function getCheckoutOrganizationId(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get("checkout") === "success" ? params.get("organizationId") : null;
}

export function useCheckoutReturn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const organizationId = getCheckoutOrganizationId(window.location.search);
    if (!organizationId) return;

    removeCheckoutParams();
    let cancelled = false;
    toast({
      title: "Payment received",
      description: "We’re activating Pro now. This usually takes a few seconds.",
    });

    void waitForProPlan({
      getBilling: () => queryClient.fetchQuery({
        queryKey: workspaceKeys.billingUsage(organizationId),
        queryFn: () => api.getOrganizationBillingUsage(organizationId),
        staleTime: 0,
      }),
    }).then((billing) => {
      if (cancelled) return;
      if (billing) {
        toast({
          title: "You’re on Pro",
          description: "Your receipt is in your email. Your expanded limits are ready.",
        });
      } else {
        toast({
          title: "Payment received",
          description: "Pro is still activating. Your plan will update automatically shortly.",
        });
      }
    });

    return () => { cancelled = true; };
  }, [queryClient, toast]);
}
