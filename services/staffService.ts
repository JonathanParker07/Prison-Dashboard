// services/staffService.ts
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { getToken } from "./authHelpers"; // helper to safely get token from AuthContext or localStorage

/** Officer shape returned by backend */
export interface Officer {
  id: string;
  name: string;
  email: string;
  prison_name?: string;
  recognitions_today?: number;
}

/** Payload used to create an officer */
export interface CreateOfficerRequest {
  name: string;
  email: string;
  password: string;
  prison_name?: string;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
});

// Always attach Authorization header dynamically
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    if (!config.headers) config.headers = {} as any;
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

export const staffService = {
  async getAll(): Promise<Officer[]> {
    const res = await api.get<Officer[]>("/officers");
    return res.data || [];
  },

  async getOne(id: string): Promise<Officer> {
    const res = await api.get<Officer>(`/officers/${id}`);
    return res.data;
  },

  async create(payload: CreateOfficerRequest): Promise<Officer> {
    const res = await api.post<Officer>("/officers", payload);
    return res.data;
  },

  async update(id: string, payload: Partial<Officer>): Promise<Officer> {
    const res = await api.put<Officer>(`/officers/${id}`, payload);
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/officers/${id}`);
  },

  async getTotalOfficers(): Promise<number> {
    const res = await api.get<number>("/officers/count");
    return res.data;
  },
};

export default staffService;
