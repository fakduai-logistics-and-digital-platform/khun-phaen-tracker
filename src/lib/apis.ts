export const API_BASE_URL = "http://127.0.0.1:3002/api";

/**
 * Clean API Module for centralized HTTP connections
 */
export const api = {
  auth: {
    login: async (email: string, password: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
    },
    register: async (email: string, password: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
    },
    logout: async (): Promise<Response> => {
      return fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    },
    me: async (): Promise<Response> => {
      // Extract the cookie directly on the client to send via header
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      return fetch(`${API_BASE_URL}/auth/me`, {
        headers,
        credentials: "include",
      });
    },
  },
  // You can add more modules here e.g.
  // rooms: { ... }
};
