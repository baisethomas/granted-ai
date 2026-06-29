import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { clearPendingSignupPlan, clearSignupCheckoutHandled, setPendingSignupPlan, markSignupCheckoutHandled } from "@/lib/signup-plan";

vi.mock("@/lib/api", () => ({
  api: {
    createProCheckout: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

import { usePostSignupCheckout } from "./usePostSignupCheckout";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";

function makeUser(id: string, signupPlan?: string): User {
  return {
    id,
    app_metadata: {},
    user_metadata: signupPlan ? { signup_plan: signupPlan } : {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as User;
}

describe("usePostSignupCheckout", () => {
  let assignedHref = "";

  beforeEach(() => {
    assignedHref = "";
    toastMock.mockReset();
    clearPendingSignupPlan();
    clearSignupCheckoutHandled();
    vi.mocked(api.createProCheckout).mockReset();
    vi.mocked(supabase.auth.updateUser).mockReset();
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: null,
    });
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        set href(url: string) {
          assignedHref = url;
        },
        get href() {
          return assignedHref;
        },
      },
    });
  });

  afterEach(() => {
    clearPendingSignupPlan();
    clearSignupCheckoutHandled();
  });

  it("completes checkout when user metadata updates mid-flight with the same id", async () => {
    let resolveCheckout!: (value: { url: string }) => void;
    vi.mocked(api.createProCheckout).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckout = resolve;
        }),
    );

    const initialUser = makeUser("user-1", "pro");
    const { rerender } = renderHook(
      ({ user, loading }) => usePostSignupCheckout(user, loading),
      { initialProps: { user: initialUser, loading: false } },
    );

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledTimes(1);
    });

    rerender({ user: makeUser("user-1"), loading: false });

    await act(async () => {
      resolveCheckout({ url: "https://checkout.stripe.com/test" });
    });

    await waitFor(() => {
      expect(assignedHref).toBe("https://checkout.stripe.com/test");
    });
    expect(api.createProCheckout).toHaveBeenCalledTimes(1);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { signup_plan: null },
    });
  });

  it("does not redirect when metadata cleanup returns an error", async () => {
    vi.mocked(api.createProCheckout).mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message: "metadata update failed", name: "AuthApiError", status: 500 } as never,
    });

    const user = makeUser("user-2", "pro");
    const { rerender } = renderHook(
      ({ user, loading }) => usePostSignupCheckout(user, loading),
      { initialProps: { user, loading: false } },
    );

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledTimes(1);
      expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
      expect(toastMock).toHaveBeenCalledTimes(1);
    });

    expect(assignedHref).toBe("");
    expect(window.sessionStorage.getItem("granted.signupPlan")).toBe("pro");

    rerender({ user: makeUser("user-2", "pro"), loading: false });

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledTimes(1);
    });
  });

  it("does not redirect when metadata cleanup rejects", async () => {
    vi.mocked(api.createProCheckout).mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });
    vi.mocked(supabase.auth.updateUser).mockRejectedValue(new Error("storage failure"));

    const user = makeUser("user-2b", "pro");
    const { rerender } = renderHook(
      ({ user, loading }) => usePostSignupCheckout(user, loading),
      { initialProps: { user, loading: false } },
    );

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledTimes(1);
      expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
      expect(toastMock).toHaveBeenCalledTimes(1);
    });

    expect(assignedHref).toBe("");

    rerender({ user: makeUser("user-2b", "pro"), loading: false });

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledTimes(1);
    });
  });

  it("marks checkout handled and redirects only after metadata cleanup succeeds", async () => {
    vi.mocked(api.createProCheckout).mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });

    renderHook(() => usePostSignupCheckout(makeUser("user-2c", "pro"), false));

    await waitFor(() => {
      expect(assignedHref).toBe("https://checkout.stripe.com/test");
    });
    expect(window.sessionStorage.getItem("granted.signupCheckoutHandled.user-2c")).toBe("1");
  });

  it("clears starter metadata without starting checkout", async () => {
    renderHook(() => usePostSignupCheckout(makeUser("user-3", "starter"), false));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        data: { signup_plan: null },
      });
    });
    expect(api.createProCheckout).not.toHaveBeenCalled();
  });

  it("starts checkout when session storage pro wins over checkout tombstone", async () => {
    markSignupCheckoutHandled("user-4");
    setPendingSignupPlan("pro");
    vi.mocked(api.createProCheckout).mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });

    renderHook(() => usePostSignupCheckout(makeUser("user-4", "pro"), false));

    await waitFor(() => {
      expect(assignedHref).toBe("https://checkout.stripe.com/test");
    });
    expect(api.createProCheckout).toHaveBeenCalledTimes(1);
  });
});
