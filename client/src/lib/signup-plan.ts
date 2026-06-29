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
