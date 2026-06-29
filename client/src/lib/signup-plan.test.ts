import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

import {
  clearPendingSignupPlan,
  clearSignupCheckoutHandled,
  clearSignupPlanMetadata,
  consumePendingSignupPlan,
  isSignupCheckoutHandled,
  markSignupCheckoutHandled,
  parseSignupPlan,
  peekPendingSignupPlan,
  readSignupPlanFromSearch,
  readSignupPlanFromUserMetadata,
  prepareExplicitProCheckout,
  resolvePendingSignupPlan,
  setPendingSignupPlan,
} from "./signup-plan";
import { supabase } from "@/lib/supabase";

describe("signup plan helpers", () => {
  beforeEach(() => {
    clearPendingSignupPlan();
    clearSignupCheckoutHandled();
    vi.mocked(supabase.auth.updateUser).mockReset();
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });
  });

  it("parses supported plan values", () => {
    expect(parseSignupPlan("starter")).toBe("starter");
    expect(parseSignupPlan("pro")).toBe("pro");
    expect(parseSignupPlan("team")).toBeNull();
  });

  it("reads plan from query strings", () => {
    expect(readSignupPlanFromSearch("?plan=pro")).toBe("pro");
    expect(readSignupPlanFromSearch("?plan=starter&foo=bar")).toBe("starter");
    expect(readSignupPlanFromSearch("?foo=bar")).toBeNull();
  });

  it("stores and consumes pending signup plans in session storage", () => {
    expect(peekPendingSignupPlan()).toBeNull();

    setPendingSignupPlan("pro");
    expect(peekPendingSignupPlan()).toBe("pro");
    expect(consumePendingSignupPlan()).toBe("pro");
    expect(peekPendingSignupPlan()).toBeNull();
  });

  it("preserves pending plan across peeks until consumed or cleared", () => {
    setPendingSignupPlan("pro");
    expect(peekPendingSignupPlan()).toBe("pro");
    expect(peekPendingSignupPlan()).toBe("pro");
    clearPendingSignupPlan();
    expect(peekPendingSignupPlan()).toBeNull();
  });

  it("reads signup plan from Supabase user metadata", () => {
    expect(readSignupPlanFromUserMetadata(null)).toBeNull();
    expect(readSignupPlanFromUserMetadata({})).toBeNull();
    expect(
      readSignupPlanFromUserMetadata({ user_metadata: { signup_plan: "pro" } }),
    ).toBe("pro");
    expect(
      readSignupPlanFromUserMetadata({ user_metadata: { signup_plan: "starter" } }),
    ).toBe("starter");
    expect(
      readSignupPlanFromUserMetadata({ user_metadata: { signup_plan: "team" } }),
    ).toBeNull();
    expect(
      readSignupPlanFromUserMetadata({ user_metadata: { signup_plan: 29 } }),
    ).toBeNull();
  });

  it("prefers session storage over user metadata when both are present", () => {
    setPendingSignupPlan("starter");
    expect(
      consumePendingSignupPlan(),
    ).toBe("starter");
    expect(
      readSignupPlanFromUserMetadata({ user_metadata: { signup_plan: "pro" } }),
    ).toBe("pro");
  });

  it("resolvePendingSignupPlan consumes session storage before metadata", () => {
    setPendingSignupPlan("starter");
    expect(
      resolvePendingSignupPlan({ user_metadata: { signup_plan: "pro" } }),
    ).toBe("starter");
    expect(peekPendingSignupPlan()).toBeNull();
    expect(
      readSignupPlanFromUserMetadata({ user_metadata: { signup_plan: "pro" } }),
    ).toBe("pro");
  });

  it("resolvePendingSignupPlan falls back to user metadata", () => {
    expect(
      resolvePendingSignupPlan({ user_metadata: { signup_plan: "pro" } }),
    ).toBe("pro");
    expect(resolvePendingSignupPlan(null)).toBeNull();
  });

  it("resolvePendingSignupPlan ignores metadata when checkout was already handled", () => {
    markSignupCheckoutHandled("user-99");
    expect(
      resolvePendingSignupPlan({
        id: "user-99",
        user_metadata: { signup_plan: "pro" },
      }),
    ).toBeNull();
    expect(isSignupCheckoutHandled("user-99")).toBe(true);
  });

  it("resolvePendingSignupPlan prefers session storage over checkout tombstone", () => {
    markSignupCheckoutHandled("user-99");
    setPendingSignupPlan("pro");
    expect(
      resolvePendingSignupPlan({
        id: "user-99",
        user_metadata: { signup_plan: "pro" },
      }),
    ).toBe("pro");
    expect(peekPendingSignupPlan()).toBeNull();
    expect(isSignupCheckoutHandled("user-99")).toBe(true);
  });

  it("prepareExplicitProCheckout clears signup state before manual checkout", async () => {
    setPendingSignupPlan("pro");
    const result = await prepareExplicitProCheckout("user-55");
    expect(result.error).toBeNull();
    expect(peekPendingSignupPlan()).toBeNull();
    expect(isSignupCheckoutHandled("user-55")).toBe(true);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { signup_plan: null },
    });
  });

  it("prepareExplicitProCheckout marks tombstone even when metadata cleanup fails", async () => {
    const authError = { message: "metadata update failed", name: "AuthApiError", status: 500 };
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: authError as never,
    });

    const result = await prepareExplicitProCheckout("user-56");
    expect(result.error).toBe(authError);
    expect(isSignupCheckoutHandled("user-56")).toBe(true);
    expect(
      resolvePendingSignupPlan({
        id: "user-56",
        user_metadata: { signup_plan: "pro" },
      }),
    ).toBeNull();
  });

  it("clearSignupPlanMetadata returns resolved Supabase errors without throwing", async () => {
    const authError = { message: "metadata update failed", name: "AuthApiError", status: 500 };
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: authError as never,
    });

    await expect(clearSignupPlanMetadata()).resolves.toEqual({ error: authError });
  });

  it("clearSignupPlanMetadata normalizes rejected updateUser promises", async () => {
    vi.mocked(supabase.auth.updateUser).mockRejectedValue(new Error("storage failure"));

    const result = await clearSignupPlanMetadata();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("storage failure");
  });
});
