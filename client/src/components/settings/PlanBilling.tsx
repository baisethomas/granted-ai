import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";
import { prepareExplicitProCheckout } from "@/lib/signup-plan";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SettingsRow, SettingsRowStacked, SettingsSection } from "./rows";
import { ArrowUpRight, CreditCard } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="flex items-center gap-4">
      <Progress value={percent} className="h-2 flex-1" />
      <span className="w-24 shrink-0 text-right text-sm text-slate-600">
        {used} of {limit}
      </span>
    </div>
  );
}

export function PlanBilling({ organizationId }: { organizationId?: string | null }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [redirecting, setRedirecting] = useState<"portal" | "upgrade" | null>(null);

  const {
    data: billing,
    isLoading,
    isError,
  } = useQuery({
    queryKey: workspaceKeys.billingUsage(organizationId),
    queryFn: () => api.getOrganizationBillingUsage(organizationId!),
    enabled: !!organizationId,
    // Plan usage moves whenever the user creates applications, uploads
    // documents, or drafts — none of which invalidate this key. Radix
    // unmounts inactive tab content, so refetching on mount keeps the
    // meters fresh on every visit to this tab instead of inheriting the
    // app-wide staleTime: Infinity.
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const openBillingPortal = async () => {
    setRedirecting("portal");
    try {
      const { url } = await api.createBillingPortalSession(organizationId ?? undefined);
      window.location.href = url;
    } catch {
      setRedirecting(null);
      toast({
        title: "Couldn't open billing",
        description: "The billing portal didn't respond. Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const startUpgrade = async () => {
    setRedirecting("upgrade");
    try {
      // Clear any pending signup-plan intent first (same as Pricing), so a
      // stale intent can't relaunch checkout when Stripe returns to /app.
      if (user) {
        const { error: cleanupError } = await prepareExplicitProCheckout(user.id);
        if (cleanupError) {
          console.warn(
            "[settings] Failed to clear signup_plan metadata before checkout:",
            cleanupError.message,
          );
        }
      }
      const { url } = await api.createProCheckout(organizationId ?? undefined);
      window.location.href = url;
    } catch {
      setRedirecting(null);
      toast({
        title: "Couldn't start the upgrade",
        description: "Checkout didn't load. Try again in a moment.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 rounded bg-slate-50" />
        ))}
      </div>
    );
  }

  if (isError || !billing) {
    return (
      <p className="py-8 text-center text-sm text-slate-600">
        Your plan details aren't available right now. Refresh to try again.
      </p>
    );
  }

  const planLabel = PLAN_LABELS[billing.plan] ?? billing.plan;
  const renewalDate = formatDate(billing.period.end);
  // A fully canceled subscription keeps its paid plan name on the row with
  // status "canceled" — treat it like Starter: no renewal copy, upgrade open.
  const subscriptionCanceled = billing.status === "canceled";
  const canUpgrade = billing.plan === "starter" || subscriptionCanceled;
  const planDescription = subscriptionCanceled
    ? "Your subscription has ended."
    : billing.billing.cancelAtPeriodEnd
      ? renewalDate
        ? `Your plan ends on ${renewalDate}.`
        : "Your plan ends at the close of this billing period."
      : renewalDate
        ? `Renews on ${renewalDate}.`
        : undefined;

  return (
    <div>
      <SettingsSection title="Plan">
        <SettingsRow title="Current plan" description={planDescription}>
          <span className="text-sm font-semibold text-slate-900">{planLabel}</span>
        </SettingsRow>
        {canUpgrade && (
          <SettingsRow
            title={subscriptionCanceled ? "Restart Pro" : "Upgrade to Pro"}
            description="Room for more applications, documents, and drafting each month."
          >
            <Button size="sm" onClick={startUpgrade} disabled={redirecting !== null}>
              {redirecting === "upgrade" ? "Opening checkout…" : "Upgrade"}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </SettingsRow>
        )}
        {billing.billing.canManageInStripe && (
          <SettingsRow
            title="Payment and invoices"
            description="Update your payment method or download invoices."
          >
            <Button size="sm" variant="outline" onClick={openBillingPortal} disabled={redirecting !== null}>
              <CreditCard className="mr-2 h-4 w-4" />
              {redirecting === "portal" ? "Opening…" : "Manage billing"}
            </Button>
          </SettingsRow>
        )}
      </SettingsSection>

      <div className="border-t border-slate-200" />

      <SettingsSection
        title="Plan usage"
        description={renewalDate ? `What you've used this period. Resets on ${renewalDate}.` : "What you've used this period."}
      >
        <SettingsRowStacked title="Applications">
          <UsageMeter used={billing.usage.projects} limit={billing.limits.projects} />
        </SettingsRowStacked>
        <SettingsRowStacked title="Documents">
          <UsageMeter used={billing.usage.documents} limit={billing.limits.documents} />
        </SettingsRowStacked>
        <SettingsRowStacked
          title="Drafting allowance"
          description="How much of this period's drafting capacity you've used."
        >
          <div className="flex items-center gap-4">
            <Progress value={billing.percentUsed.aiTokens} className="h-2 flex-1" />
            <span className="w-24 shrink-0 text-right text-sm text-slate-600">
              {billing.percentUsed.aiTokens}% used
            </span>
          </div>
        </SettingsRowStacked>
      </SettingsSection>
    </div>
  );
}

export default PlanBilling;
