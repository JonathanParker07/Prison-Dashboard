// services/api.ts
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import type {
  User,
  AuthResponse,
  InmateOut,
  CreateInmateRequest,
  UpdateInmateRequest,
  RecognitionResult,
  LogsResponse,
} from "@/types";

// ===================== BASE URLS =====================
// ✅ Use environment variable first, fallback to Render backend in production
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://prison-backend-rd0k.onrender.com";

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_BASE_URL ||
  "wss://prison-backend-rd0k.onrender.com";

// ===================== AXIOS INSTANCE =====================
const api = axios.create({ baseURL: API_BASE_URL });

// --- Request Interceptor (attach token automatically) ---
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  try {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        if (!config.headers) (config as any).headers = {};
        (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.error("request interceptor error:", err);
  }
  return config;
});

// --- Response Interceptor (handle 401 logout) ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/login";
        }
      } catch (e) {
        console.error("Failed to handle 401 redirect:", e);
      }
    }
    return Promise.reject(error);
  }
);

// ===================== SWR FETCHER =====================
export const swrFetcher = (url: string) => api.get(url).then((res) => res.data);

// ===================== AUTH =====================
export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);
    const { data } = await api.post<AuthResponse>("/auth/login", formData.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return data;
  },

  async register(name: string, email: string, password: string, prison_name?: string): Promise<User> {
    const payload: any = { name, email, password };
    if (prison_name) payload.prison_name = prison_name;
    const { data } = await api.post<User>("/auth/register", payload, { headers: { "Content-Type": "application/json" } });
    return data;
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },
};

// ===================== INMATES =====================
export const inmatesService = {
  async getInmates(): Promise<InmateOut[]> {
    const { data } = await api.get<InmateOut[]>("/inmates/");
    return data;
  },

  async getInmate(id: string): Promise<InmateOut> {
    const { data } = await api.get<InmateOut>(`/inmates/${id}/`);
    return data;
  },

  async createInmate(payload: CreateInmateRequest): Promise<InmateOut> {
    const formData = new FormData();
    formData.append("inmate_id", payload.inmate_id);
    formData.append("name", payload.name);

    if (payload.extra_info?.cell) formData.append("cell", payload.extra_info.cell);
    if (payload.extra_info?.crime) formData.append("crime", payload.extra_info.crime);
    if (payload.extra_info?.sentence) formData.append("sentence", payload.extra_info.sentence);
    if (payload.extra_info?.age !== undefined && payload.extra_info.age !== null)
      formData.append("age", String(payload.extra_info.age));
    if (payload.extra_info?.legal_status) formData.append("legal_status", payload.extra_info.legal_status);
    if (payload.extra_info?.facility_name) formData.append("facility_name", payload.extra_info.facility_name);

    payload.images.forEach((img) => formData.append("images", img));

    const { data } = await api.post<InmateOut>("/inmates/", formData);
    return data;
  },

  async updateInmate(id: string, payload: UpdateInmateRequest): Promise<InmateOut> {
    const formData = new FormData();

    if (payload.name !== undefined) formData.append("name", payload.name);
    if (payload.extra_info) {
      if (payload.extra_info.cell !== undefined) formData.append("cell", payload.extra_info.cell);
      if (payload.extra_info.crime !== undefined) formData.append("crime", payload.extra_info.crime);
      if (payload.extra_info.sentence !== undefined) formData.append("sentence", payload.extra_info.sentence);
      if (payload.extra_info.age !== undefined && payload.extra_info.age !== null)
        formData.append("age", String(payload.extra_info.age));
      if (payload.extra_info.sex !== undefined) formData.append("sex", payload.extra_info.sex ?? "");
      if (payload.extra_info.legal_status !== undefined)
        formData.append("legal_status", payload.extra_info.legal_status);
      if (payload.extra_info.facility_name !== undefined)
        formData.append("facility_name", payload.extra_info.facility_name);
    }

    const { data } = await api.patch<InmateOut>(`/inmates/${id}/`, formData);
    return data;
  },

  async deleteInmate(id: string): Promise<void> {
    await api.delete(`/inmates/${id}/`);
  },
};

// ===================== RECOGNITION =====================
export const recognitionService = {
  async recognizeImage(image: File): Promise<RecognitionResult> {
    const formData = new FormData();
    formData.append("image", image);
    const { data } = await api.post<RecognitionResult>("/recognize/", formData);
    return data;
  },
};

// ===================== LOGS =====================
export const logsService = {
  async getDailyRecognitions(days = 7): Promise<LogsResponse> {
    const { data } = await api.get(`/stats/recognitions-daily?days=${days}`);
    return data;
  },

  async getTopInmates(days = 30): Promise<LogsResponse> {
    const { data } = await api.get(`/stats/top-inmates?days=${days}`);
    return data;
  },

  async getRecognitionsByOfficer(): Promise<LogsResponse> {
    const { data } = await api.get("/stats/recognitions-by-officer");
    return data;
  },

  async getRecentVerifications(limit = 5): Promise<LogsResponse> {
    const { data } = await api.get(`/stats/recent-verifications?limit=${limit}`);
    return data;
  },

  async getAgeDistribution(): Promise<LogsResponse> {
    const { data } = await api.get("/stats/age-distribution");
    return data;
  },

  async getSexDistribution(): Promise<LogsResponse> {
    const { data } = await api.get("/stats/sex-distribution");
    return data;
  },

  async getLegalStatusDistribution(): Promise<LogsResponse> {
    const { data } = await api.get("/stats/legal-status-distribution");
    return data;
  },

  async getFacilityDistribution(): Promise<LogsResponse> {
    const { data } = await api.get("/stats/facility-distribution");
    return data;
  },

  async getRecognitionsTodayByOfficer(): Promise<{ count: number }> {
    const { data } = await api.get("/stats/recognitions-today-by-officer");
    return data;
  },

  connectLiveActivity(onMessage: (data: any) => void) {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
    if (!token) return null;

    const wsUrl = `${WS_BASE_URL}/stats/ws/activity?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log("✅ WebSocket connected");
    ws.onclose = (e) => console.log("❌ WebSocket disconnected", e);
    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    };

    return ws;
  },
};

// ===================== OFFICERS =====================
export const officersService = {
  async getTotalOfficers(): Promise<number> {
    const { data } = await api.get("/officers/count");
    if (typeof data === "number") return data;
    if (data && typeof data.total === "number") return data.total;
    return 0;
  },

  async getAll(): Promise<any[]> {
    const { data } = await api.get("/officers/");
    return data;
  },
};

export default api;
