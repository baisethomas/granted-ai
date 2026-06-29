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
  consumePendingSignupPlan,
  parseSignupPlan,
  peekPendingSignupPlan,
  readSignupPlanFromSearch,
  readSignupPlanFromUserMetadata,
  resolvePendingSignupPlan,
  setPendingSignupPlan,
} from "./signup-plan";

describe("signup plan helpers", () => {
  beforeEach(() => {
    clearPendingSignupPlan();
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
});
