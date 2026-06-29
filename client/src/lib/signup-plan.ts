import { supabase } from "@/lib/supabase";

export type SignupPlan = "starter" | "pro";

const STORAGE_KEY = "granted.signupPlan";
const CHECKOUT_HANDLED_PREFIX = "granted.signupCheckoutHandled.";

export function parseSignupPlan(value: string | null | undefined): SignupPlan | null {
  if (value === "starter" || value === "pro") {
    return value;
  }
  return null;
}

export function readSignupPlanFromSearch(search: string): SignupPlan | null {
  if (!search) return null;
  return parseSignupPlan(new URLSearchParams(search).get("plan"));
}

export function setPendingSignupPlan(plan: SignupPlan): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, plan);
}

export function peekPendingSignupPlan(): SignupPlan | null {
  if (typeof window === "undefined") return null;
  return parseSignupPlan(window.sessionStorage.getItem(STORAGE_KEY));
}

export function clearPendingSignupPlan(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function consumePendingSignupPlan(): SignupPlan | null {
  const plan = peekPendingSignupPlan();
  if (plan) {
    clearPendingSignupPlan();
  }
  return plan;
}

export function readSignupPlanFromUserMetadata(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): SignupPlan | null {
  if (!user?.user_metadata) return null;
  const raw = user.user_metadata.signup_plan;
  return parseSignupPlan(typeof raw === "string" ? raw : null);
}

/** Session-scoped tombstone so a handled checkout cannot re-trigger from stale metadata. */
export function markSignupCheckoutHandled(userId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${CHECKOUT_HANDLED_PREFIX}${userId}`, "1");
}

export function isSignupCheckoutHandled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`${CHECKOUT_HANDLED_PREFIX}${userId}`) === "1";
}

export function clearSignupCheckoutHandled(userId?: string): void {
  if (typeof window === "undefined") return;
  if (userId) {
    window.sessionStorage.removeItem(`${CHECKOUT_HANDLED_PREFIX}${userId}`);
    return;
  }
  for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = window.sessionStorage.key(i);
    if (key?.startsWith(CHECKOUT_HANDLED_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

/** Session storage wins over user metadata; storage entry is consumed. */
export function resolvePendingSignupPlan(
  user: { id?: string; user_metadata?: Record<string, unknown> } | null | undefined,
): SignupPlan | null {
  if (user?.id && isSignupCheckoutHandled(user.id)) {
    return null;
  }
  const fromStorage = consumePendingSignupPlan();
  if (fromStorage) {
    return fromStorage;
  }
  return readSignupPlanFromUserMetadata(user);
}

/** Clear signup_plan from Supabase user metadata after it has been acted on. */
export async function clearSignupPlanMetadata(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.updateUser({ data: { signup_plan: null } });
    if (error) {
      console.warn("[signup-plan] Failed to clear signup_plan metadata:", error.message);
      return { error };
    }
    return { error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.warn("[signup-plan] Failed to clear signup_plan metadata:", error.message);
    return { error };
  }
}
