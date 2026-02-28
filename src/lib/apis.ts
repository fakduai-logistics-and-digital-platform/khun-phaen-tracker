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
      return fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
    },
  },
  // You can add more modules here e.g.
  // rooms: { ... }
};
