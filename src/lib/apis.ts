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
    invite: async (payload: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/auth/invite`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
    },
    getSetupInfo: async (token: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/auth/setup-info?token=${token}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });
    },
    setupPassword: async (
      token: string,
      password: string,
    ): Promise<Response> => {
      return fetch(`${API_BASE_URL}/auth/setup-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
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
    updateMe: async (payload: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/auth/me`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
    },
    listUsers: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/auth/users`, {
        headers,
        credentials: "include",
      });
    },
    deleteUser: async (id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/auth/users/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
    },
    updateUser: async (
      id: string,
      payload: Record<string, any>,
    ): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/auth/users/${id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
    },
  },
  workspaces: {
    getList: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces`, {
        headers,
        credentials: "include",
      });
    },
    create: async (name: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ name }),
      });
    },
    checkAccess: async (roomCode: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/access/${roomCode}`, {
        headers,
        credentials: "include",
      });
    },
    update: async (id: string, name: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/${id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({ name }),
      });
    },
    delete: async (id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(
          new RegExp("(^| )_khun_ph_token=([^;]+)"),
        );
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/${id}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
    },
  },

  // Workspace-scoped data APIs
  data: {
    _token: (): string => {
      if (typeof document === "undefined") return "";
      const match = document.cookie.match(
        new RegExp("(^| )_khun_ph_token=([^;]+)"),
      );
      return match ? match[2] : "";
    },
    _headers: (json = false): Record<string, string> => {
      const h: Record<string, string> = { Accept: "application/json" };
      const t = api.data._token();
      if (t) h["Authorization"] = `Bearer ${t}`;
      if (json) h["Content-Type"] = "application/json";
      return h;
    },

    // Tasks
    tasks: {
      list: (
        wsId: string,
        filter?: Record<string, string>,
      ): Promise<Response> => {
        const params = filter
          ? "?" + new URLSearchParams(filter).toString()
          : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks${params}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, task: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(task),
        });
      },
      update: (
        wsId: string,
        taskId: string,
        updates: Record<string, any>,
      ): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(updates),
        });
      },
      delete: (wsId: string, taskId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },

    // Projects
    projects: {
      list: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/projects`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (
        wsId: string,
        project: Record<string, any>,
      ): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/projects`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(project),
        });
      },
      update: (
        wsId: string,
        projectId: string,
        updates: Record<string, any>,
      ): Promise<Response> => {
        return fetch(
          `${API_BASE_URL}/workspaces/${wsId}/projects/${projectId}`,
          {
            method: "PUT",
            headers: api.data._headers(true),
            credentials: "include",
            body: JSON.stringify(updates),
          },
        );
      },
      delete: (wsId: string, projectId: string): Promise<Response> => {
        return fetch(
          `${API_BASE_URL}/workspaces/${wsId}/projects/${projectId}`,
          {
            method: "DELETE",
            headers: api.data._headers(),
            credentials: "include",
          },
        );
      },
    },

    // Assignees
    assignees: {
      list: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignees`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (
        wsId: string,
        assignee: Record<string, any>,
      ): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignees`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(assignee),
        });
      },
      update: (
        wsId: string,
        assigneeId: string,
        updates: Record<string, any>,
      ): Promise<Response> => {
        return fetch(
          `${API_BASE_URL}/workspaces/${wsId}/assignees/${assigneeId}`,
          {
            method: "PUT",
            headers: api.data._headers(true),
            credentials: "include",
            body: JSON.stringify(updates),
          },
        );
      },
      delete: (wsId: string, assigneeId: string): Promise<Response> => {
        return fetch(
          `${API_BASE_URL}/workspaces/${wsId}/assignees/${assigneeId}`,
          {
            method: "DELETE",
            headers: api.data._headers(),
            credentials: "include",
          },
        );
      },
    },
  },
};
