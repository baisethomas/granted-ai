import { supabase } from "@/lib/supabase";

export type SignupPlan = "starter" | "pro";

const STORAGE_KEY = "granted.signupPlan";

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

/** Session storage wins over user metadata; storage entry is consumed. */
export function resolvePendingSignupPlan(
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
): SignupPlan | null {
  const fromStorage = consumePendingSignupPlan();
  if (fromStorage) {
    return fromStorage;
  }
  return readSignupPlanFromUserMetadata(user);
}

/** Clear signup_plan from Supabase user metadata after it has been acted on. */
export async function clearSignupPlanMetadata(): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.updateUser({ data: { signup_plan: null } });
  if (error) {
    console.warn("[signup-plan] Failed to clear signup_plan metadata:", error.message);
  }
  return { error: error ?? null };
}
