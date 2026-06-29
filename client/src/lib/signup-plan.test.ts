import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPendingSignupPlan,
  consumePendingSignupPlan,
  parseSignupPlan,
  peekPendingSignupPlan,
  readSignupPlanFromSearch,
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
});
