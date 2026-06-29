import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { clearPendingSignupPlan } from "@/lib/signup-plan";

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

  it("still redirects when metadata cleanup fails after checkout URL is returned", async () => {
    vi.mocked(api.createProCheckout).mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message: "metadata update failed", name: "AuthApiError", status: 500 } as never,
    });

    renderHook(() => usePostSignupCheckout(makeUser("user-2", "pro"), false));

    await waitFor(() => {
      expect(api.createProCheckout).toHaveBeenCalledTimes(1);
      expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(assignedHref).toBe("https://checkout.stripe.com/test");
    });
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
});
