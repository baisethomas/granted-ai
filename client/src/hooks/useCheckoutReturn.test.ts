import { describe, expect, it, vi } from "vitest";
import { waitForProPlan } from "./useCheckoutReturn";

vi.mock("@/lib/api", () => ({ api: {} }));

function billing(plan: string) {
  return { plan } as any;
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
});
