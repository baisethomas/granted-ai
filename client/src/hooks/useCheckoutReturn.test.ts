import { describe, expect, it, vi } from "vitest";
import { getCheckoutOrganizationId, waitForProPlan } from "./useCheckoutReturn";

vi.mock("@/lib/api", () => ({ api: {} }));

function billing(plan: string, status = "active") {
  return { plan, status } as any;
}

describe("waitForProPlan", () => {
  it("polls until the webhook reports Pro", async () => {
    const getBilling = vi.fn()
      .mockResolvedValueOnce(billing("starter"))
      .mockResolvedValueOnce(billing("starter"))
      .mockResolvedValueOnce(billing("pro"));
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await waitForProPlan({ getBilling, wait, attempts: 5 });

    expect(result?.plan).toBe("pro");
    expect(getBilling).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("retries transient failures and returns null after the polling window", async () => {
    const getBilling = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(billing("starter"));
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(waitForProPlan({ getBilling, wait, attempts: 3 })).resolves.toBeNull();
    expect(getBilling).toHaveBeenCalledTimes(3);
  });

  it("does not treat a canceled Pro subscription as reactivated", async () => {
    const getBilling = vi.fn()
      .mockResolvedValueOnce(billing("pro", "canceled"))
      .mockResolvedValueOnce(billing("pro", "active"));
    const wait = vi.fn().mockResolvedValue(undefined);

    const result = await waitForProPlan({ getBilling, wait, attempts: 2 });

    expect(result?.status).toBe("active");
    expect(getBilling).toHaveBeenCalledTimes(2);
  });
});

describe("getCheckoutOrganizationId", () => {
  it("uses the organization carried by the Stripe return URL", () => {
    expect(getCheckoutOrganizationId("?checkout=success&organizationId=org-paid")).toBe("org-paid");
  });

  it("ignores organization ids outside a successful checkout return", () => {
    expect(getCheckoutOrganizationId("?checkout=canceled&organizationId=org-paid")).toBeNull();
    expect(getCheckoutOrganizationId("?checkout=success")).toBeNull();
  });
});
