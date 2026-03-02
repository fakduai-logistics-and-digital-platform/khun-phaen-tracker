// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { user, initAuth, getCookie } from "./auth";
import { get } from "svelte/store";

describe("Auth Store", () => {
  beforeEach(() => {
    // Clear stores and storage
    user.set(null);
    localStorage.clear();
    document.cookie = "_khun_ph_token=; path=/; max-age=0; samesite=Lax";
    vi.restoreAllMocks();
  });

  it("should be null initially", () => {
    expect(get(user)).toBeNull();
  });

  it("should initialize user from localStorage if token exists", async () => {
    // Mock getCookie to return a token
    document.cookie = "_khun_ph_token=test-token; path=/";

    localStorage.setItem("user_email", "test@example.com");
    localStorage.setItem("user_id", "123");
    localStorage.setItem("user_uuid", "uuid-123");
    localStorage.setItem("user_role", "admin");

    // We don't want to actually call the API
    vi.mock("$lib/apis", () => ({
      api: {
        auth: {
          me: vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
              Promise.resolve({
                id: "123",
                email: "test@example.com",
                user_id: "uuid-123",
                role: "admin",
              }),
          }),
        },
      },
    }));

    await initAuth();

    const currentUser = get(user);
    expect(currentUser).not.toBeNull();
    expect(currentUser?.email).toBe("test@example.com");
    expect(currentUser?.role).toBe("admin");
  });

  it("should clear user if no token exists", async () => {
    localStorage.setItem("user_email", "test@example.com");
    localStorage.setItem("user_id", "123");

    await initAuth();

    expect(get(user)).toBeNull();
  });
});
