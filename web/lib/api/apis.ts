import { apiFetch as fetch } from "./api-fetch";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3002/api";

/**
 * Clean API Module for centralized HTTP connections
 */
export const api = {
  auth: {
    login: async (email: string, password: string, turnstileToken = ""): Promise<Response> => {
      return fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, turnstile_token: turnstileToken }),
      });
    },
    invite: async (payload: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
    setupPassword: async (token: string, password: string): Promise<Response> => {
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
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
    listUsers: async (workspaceId?: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : "";

      return fetch(`${API_BASE_URL}/auth/users${query}`, {
        headers,
        credentials: "include",
      });
    },
    listUserProfiles: async (workspaceId: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/auth/users/profiles?workspace_id=${encodeURIComponent(workspaceId)}`, {
        headers,
        credentials: "include",
      });
    },
    deleteUser: async (id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
    updateUser: async (id: string, payload: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
  admin: {
    storageConfig: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/storage/config`, {
        headers,
        credentials: "include",
      });
    },
    updateStorageConfig: async (payload: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/storage/config`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
    },
    resetStorageConfig: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/storage/config/reset`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    },
    aiConfig: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/ai/config`, {
        headers,
        credentials: "include",
      });
    },
    updateAiConfig: async (payload: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/ai/config`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      });
    },
    resetAiConfig: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/ai/config/reset`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    },
    listLlmModels: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/ai/models`, {
        headers,
        credentials: "include",
      });
    },
    listEmbeddingsModels: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/ai/embeddings-models`, {
        headers,
        credentials: "include",
      });
    },
    storageStats: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/storage/stats`, {
        headers,
        credentials: "include",
      });
    },
    listStorageObjects: async (page: number = 1, limit: number = 10): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      return fetch(`${API_BASE_URL}/admin/storage/objects?${query.toString()}`, {
        headers,
        credentials: "include",
      });
    },
    deleteStorageObject: async (key: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/storage/objects/${key}`, {
        method: "DELETE",
        headers,
        credentials: "include",
      });
    },
    bulkDeleteStorageObjects: async (keys: string[]): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/admin/storage/objects/bulk-delete`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ keys }),
      });
    },
  },
  my: {
    tasks: {
      list: (filter?: Record<string, string>): Promise<Response> => {
        const params = filter ? "?" + new URLSearchParams(filter).toString() : "";
        return fetch(`${API_BASE_URL}/my/tasks${params}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },
  },
  workspaces: {
    getList: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces`, {
        headers,
        credentials: "include",
      });
    },
    create: async (name: string, color?: string, icon?: string, shortName?: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
        body: JSON.stringify({ name, color, icon, short_name: shortName }),
      });
    },
    getStats: async (): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/stats`, {
        headers,
        credentials: "include",
      });
    },
    checkAccess: async (roomCode: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }

      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/access/${roomCode}`, {
        headers,
        credentials: "include",
      });
    },
    update: async (id: string, name: string, color?: string, icon?: string, shortName?: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
        body: JSON.stringify({ name, color, icon, short_name: shortName }),
      });
    },
    delete: async (id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
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
    getNotificationConfig: async (id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/${id}/notifications`, {
        headers,
        credentials: "include",
      });
    },
    updateNotificationConfig: async (id: string, config: any): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      return fetch(`${API_BASE_URL}/workspaces/${id}/notifications`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(config),
      });
    },
    getMilestones: async (id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`${API_BASE_URL}/workspaces/${id}/milestones`, {
        headers,
        credentials: "include",
      });
    },
    createMilestone: async (id: string, milestone: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`${API_BASE_URL}/workspaces/${id}/milestones`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(milestone),
      });
    },
    updateMilestone: async (wsId: string, id: string, updates: Record<string, any>): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/milestones/${id}`, {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(updates),
      });
    },
    deleteMilestone: async (wsId: string, id: string): Promise<Response> => {
      let token = "";
      if (typeof document !== "undefined") {
        const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
        if (match) token = match[2];
      }
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/milestones/${id}`, {
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
      const match = document.cookie.match(new RegExp("(^| )_khun_ph_token=([^;]+)"));
      return match ? match[2] : "";
    },
    _headers: (json = false): Record<string, string> => {
      const h: Record<string, string> = { Accept: "application/json" };
      const t = api.data._token();
      if (t) h["Authorization"] = `Bearer ${t}`;
      if (json) h["Content-Type"] = "application/json";
      return h;
    },

    ai: {
      chatTasks: (wsId: string, payload: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/ai/tasks/chat`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      textToSpeech: (wsId: string, text: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/ai/text-to-speech`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ text }),
        });
      },
      generateTask: (wsId: string, payload: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/ai/tasks/generate`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
    },

    // Tasks
    tasks: {
      list: (wsId: string, filter?: Record<string, string>): Promise<Response> => {
        const params = filter ? "?" + new URLSearchParams(filter).toString() : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks${params}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      nextNumber: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/next-number`, {
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
      get: (wsId: string, taskId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      update: (wsId: string, taskId: string, updates: Record<string, any>): Promise<Response> => {
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
      getDailyReport: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/daily-report`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },

    comments: {
      list: (wsId: string, taskId: string, params?: Record<string, string>): Promise<Response> => {
        const query = params ? "?" + new URLSearchParams(params).toString() : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}/comments${query}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, taskId: string, formData: FormData): Promise<Response> => {
        const headers = api.data._headers();
        delete headers["Content-Type"];
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}/comments`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });
      },
      delete: (wsId: string, taskId: string, commentId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}/comments/${commentId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      update: (wsId: string, taskId: string, commentId: string, payload: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}/comments/${commentId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      toggleReaction: (
        wsId: string,
        taskId: string,
        commentId: string,
        payload: Record<string, any>,
      ): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}/comments/${commentId}/reactions`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      images: (wsId: string, taskId: string, commentId: string, params?: Record<string, string>): Promise<Response> => {
        const query = params ? "?" + new URLSearchParams(params).toString() : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/tasks/${taskId}/comments/${commentId}/images${query}`, {
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
      stats: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/projects/stats`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, project: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/projects`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(project),
        });
      },
      update: (wsId: string, projectId: string, updates: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/projects/${projectId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(updates),
        });
      },
      delete: (wsId: string, projectId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/projects/${projectId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
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
      stats: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignees/stats`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, assignee: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignees`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(assignee),
        });
      },
      update: (wsId: string, assigneeId: string, updates: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignees/${assigneeId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(updates),
        });
      },
      delete: (wsId: string, assigneeId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignees/${assigneeId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },

    assigneeGroups: {
      list: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignee-groups`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, payload: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignee-groups`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      update: (wsId: string, groupId: string, payload: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignee-groups/${groupId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      delete: (wsId: string, groupId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/assignee-groups/${groupId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },

    // Sprints
    sprints: {
      list: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/sprints`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, sprint: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/sprints`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(sprint),
        });
      },
      update: (wsId: string, sprintId: string, updates: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/sprints/${sprintId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(updates),
        });
      },
      delete: (wsId: string, sprintId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/sprints/${sprintId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },
    // Checklist Templates
    checklistTemplates: {
      list: (wsId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/checklist-templates`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, template: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/checklist-templates`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(template),
        });
      },
      update: (wsId: string, templateId: string, updates: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/checklist-templates/${templateId}`, {
          method: "PUT",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(updates),
        });
      },
      delete: (wsId: string, templateId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/checklist-templates/${templateId}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },
    // Test Cases
    testCases: {
      list: (
        wsId: string,
        params?: {
          suite_id?: string;
          project_id?: string;
          limit?: number;
          page?: number;
          q?: string;
          field?: string;
          priority?: string;
          status?: string;
          fixed?: string;
          assign_dev?: string;
        },
      ): Promise<Response> => {
        const cleanParams = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined));
        const query =
          cleanParams && Object.keys(cleanParams).length > 0
            ? "?" + new URLSearchParams(cleanParams as any).toString()
            : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases${query}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      counts: (wsId: string, projectId?: string): Promise<Response> => {
        const query = projectId && projectId !== "all" ? `?project_id=${encodeURIComponent(projectId)}` : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases/counts${query}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      all: (
        wsId: string,
        params?: {
          suite_id?: string;
          project_id?: string;
          q?: string;
          field?: string;
          priority?: string;
          status?: string;
          fixed?: string;
          assign_dev?: string;
        },
      ): Promise<Response> => {
        const qs = params
          ? "?" +
            new URLSearchParams(
              Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
            ).toString()
          : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases/all${qs}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      history: (id: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/history`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      get: (id: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      nextNumber: (wsId: string, projectId?: string): Promise<Response> => {
        const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases/next-number${query}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      renumber: (wsId: string, projectId: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases/renumber`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ project_id: projectId }),
        });
      },
      create: (wsId: string, testCase: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(testCase),
        });
      },
      delete: (id: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      update: (id: string, testCase: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(testCase),
        });
      },
      updateSteps: (
        id: string,
        payload: { step_format: string; classic_steps?: any[]; gherkin_steps?: any[] },
      ): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/steps`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      updateStatus: (id: string, status: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/status`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ status }),
        });
      },
      updateFixed: (id: string, fixed: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/fixed`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ fixed }),
        });
      },
      updateAssignDev: (id: string, assign_dev: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/assign-dev`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ assign_dev }),
        });
      },
      updatePriority: (id: string, priority: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/priority`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ priority }),
        });
      },
      updateAssignTester: (id: string, assign_tester: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/assign-tester`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify({ assign_tester }),
        });
      },
      updateNotes: (id: string, payload: { dev_note?: string; test_note?: string }): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/notes`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      convertToTask: (id: string): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-cases/${id}/convert-to-task`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
        });
      },
      uploadAttachment: (wsId: string, testCaseId: string, formData: FormData): Promise<Response> => {
        const headers = api.data._headers();
        // Browser sets Content-Type automatically for FormData with boundary
        delete headers["Content-Type"];
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-cases/${testCaseId}/attachments`, {
          method: "POST",
          headers,
          credentials: "include",
          body: formData,
        });
      },
    },
    // Test Suites
    testSuites: {
      list: (wsId: string, projectId?: string): Promise<Response> => {
        const query = projectId && projectId !== "all" ? `?project_id=${encodeURIComponent(projectId)}` : "";
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-suites${query}`, {
          headers: api.data._headers(),
          credentials: "include",
        });
      },
      create: (wsId: string, suite: Record<string, any>): Promise<Response> => {
        return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-suites`, {
          method: "POST",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(suite),
        });
      },
      update: (id: string, payload: { title?: string; project_id?: string }): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-suites/${id}`, {
          method: "PATCH",
          headers: api.data._headers(true),
          credentials: "include",
          body: JSON.stringify(payload),
        });
      },
      delete: (id: string, mode: "move" | "delete" = "move"): Promise<Response> => {
        return fetch(`${API_BASE_URL}/test-suites/${id}?mode=${mode}`, {
          method: "DELETE",
          headers: api.data._headers(),
          credentials: "include",
        });
      },
    },
  },
  public: {
    listSuites: (wsId: string, projectId?: string): Promise<Response> => {
      const query = projectId && projectId !== "all" ? `?project_id=${encodeURIComponent(projectId)}` : "";
      return fetch(`${API_BASE_URL}/public/workspaces/${wsId}/test-suites${query}`);
    },
    listProjects: (wsId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/public/workspaces/${wsId}/projects`);
    },
    listTestCases: (
      wsId: string,
      params?: {
        suite_id?: string;
        project_id?: string;
        limit?: number;
        page?: number;
        q?: string;
        field?: string;
        priority?: string;
        status?: string;
        fixed?: string;
      },
    ): Promise<Response> => {
      const cleanParams = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined));
      const query =
        cleanParams && Object.keys(cleanParams).length > 0
          ? "?" + new URLSearchParams(cleanParams as any).toString()
          : "";
      return fetch(`${API_BASE_URL}/public/workspaces/${wsId}/test-cases${query}`);
    },
    getAllTestCases: (
      wsId: string,
      params?: {
        suite_id?: string;
        project_id?: string;
        q?: string;
        field?: string;
        priority?: string;
        status?: string;
        fixed?: string;
        assign_dev?: string;
      },
    ): Promise<Response> => {
      const qs = params
        ? "?" +
          new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null && v !== "") as [string, string][],
          ).toString()
        : "";
      return fetch(`${API_BASE_URL}/public/workspaces/${wsId}/all-test-cases${qs}`);
    },
    getLatestTestRun: (wsId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/public/workspaces/${wsId}/test-runs/latest`);
    },
    getSummary: (wsId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/public/workspaces/${wsId}/summary`);
    },
  },
  testRuns: {
    list: (wsId: string, page = 1, limit = 10): Promise<Response> => {
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-runs?page=${page}&limit=${limit}`, {
        headers: api.data._headers(),
        credentials: "include",
      });
    },
    get: (wsId: string, runId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-runs/${runId}`, {
        headers: api.data._headers(),
        credentials: "include",
      });
    },
    create: (
      wsId: string,
      payload: {
        name: string;
        description?: string;
        default_assignee?: string;
        operating_system?: string;
        test_case_ids: string[];
      },
    ): Promise<Response> => {
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-runs`, {
        method: "POST",
        headers: { ...api.data._headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
    },
    updateStatus: (wsId: string, runId: string, status: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-runs/${runId}/status`, {
        method: "PATCH",
        headers: { ...api.data._headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
    },
    updateCaseStatus: (wsId: string, runId: string, tcId: string, status: string, note?: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-runs/${runId}/cases/${tcId}/status`, {
        method: "PATCH",
        headers: { ...api.data._headers(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, note }),
      });
    },
    delete: (wsId: string, runId: string): Promise<Response> => {
      return fetch(`${API_BASE_URL}/workspaces/${wsId}/test-runs/${runId}`, {
        method: "DELETE",
        headers: api.data._headers(),
        credentials: "include",
      });
    },
  },

  userNotifications: {
    list: (): Promise<Response> =>
      fetch(`${API_BASE_URL}/notifications`, {
        headers: api.data._headers(),
        credentials: "include",
      }),
    create: (payload: Record<string, any>): Promise<Response> =>
      fetch(`${API_BASE_URL}/notifications`, {
        method: "POST",
        headers: api.data._headers(true),
        credentials: "include",
        body: JSON.stringify(payload),
      }),
    markRead: (dbId: string): Promise<Response> =>
      fetch(`${API_BASE_URL}/notifications/${dbId}/read`, {
        method: "PATCH",
        headers: api.data._headers(),
        credentials: "include",
      }),
    delete: (dbId: string): Promise<Response> =>
      fetch(`${API_BASE_URL}/notifications/${dbId}`, {
        method: "DELETE",
        headers: api.data._headers(),
        credentials: "include",
      }),
    markAllRead: (): Promise<Response> =>
      fetch(`${API_BASE_URL}/notifications/read-all`, {
        method: "POST",
        headers: api.data._headers(),
        credentials: "include",
      }),
  },
  apiKeys: {
    list: (): Promise<Response> =>
      fetch(`${API_BASE_URL}/auth/api-keys`, { headers: api.data._headers(), credentials: "include" }),
    create: (name: string): Promise<Response> =>
      fetch(`${API_BASE_URL}/auth/api-keys`, {
        method: "POST",
        headers: api.data._headers(true),
        credentials: "include",
        body: JSON.stringify({ name }),
      }),
    revoke: (id: string): Promise<Response> =>
      fetch(`${API_BASE_URL}/auth/api-keys/${id}/revoke`, {
        method: "POST",
        headers: api.data._headers(true),
        credentials: "include",
        body: "{}",
      }),
    remove: (id: string): Promise<Response> =>
      fetch(`${API_BASE_URL}/auth/api-keys/${id}`, {
        method: "DELETE",
        headers: api.data._headers(),
        credentials: "include",
      }),
  },
  workzy: {
    status: (): Promise<Response> =>
      fetch(`${API_BASE_URL}/integrations/workzy`, { headers: api.data._headers(), credentials: "include" }),
    connect: (code: string, password: string): Promise<Response> =>
      fetch(`${API_BASE_URL}/integrations/workzy`, {
        method: "POST",
        headers: api.data._headers(true),
        credentials: "include",
        body: JSON.stringify({ code, password }),
      }),
    disconnect: (): Promise<Response> =>
      fetch(`${API_BASE_URL}/integrations/workzy`, {
        method: "DELETE",
        headers: api.data._headers(),
        credentials: "include",
      }),
    today: (): Promise<Response> =>
      fetch(`${API_BASE_URL}/integrations/workzy/today`, { headers: api.data._headers(), credentials: "include" }),
  },
};
