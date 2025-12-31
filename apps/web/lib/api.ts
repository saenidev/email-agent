import axios from "axios";

export const api = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// API functions
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", new URLSearchParams({ username: email, password }), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  register: (email: string, password: string) =>
    api.post("/auth/register", { email, password }),
  me: () => api.get("/auth/me"),
};

export const gmailApi = {
  getAuthUrl: () => api.get<{ auth_url: string }>("/gmail/auth/url"),
  getStatus: () => api.get<{ connected: boolean; email: string | null }>("/gmail/status"),
  disconnect: () => api.delete("/gmail/disconnect"),
};

export const emailsApi = {
  list: (page = 1, pageSize = 20) =>
    api.get(`/emails?page=${page}&page_size=${pageSize}`),
  get: (id: string) => api.get(`/emails/${id}`),
  sync: () => api.post("/emails/sync"),
};

export const draftsApi = {
  list: (status?: string, page = 1, pageSize = 20) =>
    api.get(`/drafts?page=${page}&page_size=${pageSize}${status ? `&status=${status}` : ""}`),
  get: (id: string) => api.get(`/drafts/${id}`),
  update: (id: string, data: any) => api.put(`/drafts/${id}`, data),
  approve: (id: string) => api.post(`/drafts/${id}/approve`),
  reject: (id: string) => api.post(`/drafts/${id}/reject`),
  regenerate: (id: string, customPrompt?: string) =>
    api.post(`/drafts/${id}/regenerate`, { custom_prompt: customPrompt }),
};

export const rulesApi = {
  list: () => api.get("/rules"),
  get: (id: string) => api.get(`/rules/${id}`),
  create: (data: any) => api.post("/rules", data),
  update: (id: string, data: any) => api.put(`/rules/${id}`, data),
  delete: (id: string) => api.delete(`/rules/${id}`),
  toggle: (id: string) => api.post(`/rules/${id}/toggle`),
};

export const settingsApi = {
  get: () => api.get("/settings"),
  update: (data: any) => api.put("/settings", data),
  getModels: () => api.get<{ id: string; name: string }[]>("/settings/models"),
};
