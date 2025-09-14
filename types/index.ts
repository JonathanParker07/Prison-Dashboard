// types.ts
// ----------------- Shared types (replace your current @/types) -----------------

// ---------- Auth ----------

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Auth response shape based on your FastAPI login response
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ---------- Inmate ----------

export interface InmateImage {
  vector: number[];
  filename: string;
  uploaded_at: string;
}

export interface InmateExtraInfo {
  cell?: string;
  crime?: string;
  sentence?: string;
  age?: number; // 🔹 Age for analytics & charts
  legal_status?: string; // e.g. Convicted, Awaiting Trial, etc.
  facility_name?: string; // Facility holding the inmate
  sex?: "male" | "female";
}

export interface InmateOut {
  id: string;
  inmate_id: string;
  name: string;
  extra_info: InmateExtraInfo; // ❗ always an object, even if empty
  images: InmateImage[];
  created_at: string;
  updated_at?: string; // optional
}

export interface CreateInmateRequest {
  inmate_id: string;
  name: string;
  extra_info: InmateExtraInfo;
  images: File[];
}

export interface UpdateInmateRequest {
  name?: string;
  extra_info?: InmateExtraInfo; // 🔹 Includes Age, Legal Status, Facility
}

// ---------- Face Recognition ----------

/**
 * Bounding box returned by backend or produced client-side.
 * Coordinates may be either pixel values or normalized (0..1).
 */
export interface RecognitionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  recognized?: boolean; // true => known face (green), false => unknown (red)
  name?: string | null;
  score?: number; // 0..1
}

/**
 * Result returned by /recognize endpoint (frontend-friendly).
 *
 * Notes:
 * - Some backends return `image_base64` (boxed image). Frontend often maps it to a data URL.
 * - `imageUrl` (string) is optional and convenient; either `image_base64` or `imageUrl` may be present.
 * - `boxes` is optional; if present, client will draw bounding boxes.
 * - `name` and `inmate_id` can be null when there's no match.
 */
export interface RecognitionResult {
  inmate_id: string | null;
  name: string | null;
  prison_name?: string | null;
  score: number;
  method?: string | null; // "cosine" | "euclidean" | "none" etc.

  // Optional boxed image returned from backend as raw base64 (no data: prefix)
  image_base64?: string | null;

  // Optional convenient URL (frontend can be given `data:image/jpeg;base64,...` or a real URL)
  imageUrl?: string | null;

  // Optional per-face boxes (pixel or normalized coords)
  boxes?: RecognitionBox[];
}

// ---------- Analytics ----------

export interface DailyRecognition {
  _id: string; // typically a date or day label
  count: number;
}

export interface TopInmate {
  inmate: string;
  count: number;
}

export interface OfficerRecognition {
  officer: string;
  count: number;
}

// ---------- Distribution Entry ----------
// Always expose a friendly `label` for charts
export interface DistributionEntry {
  name?: string; // may come from backend
  _id?: string; // may come from backend
  count: number;

  // derived in frontend: label = name || _id || "Unknown"
  label?: string;
}

// ---------- Logs Response ----------

export interface LogsResponse {
  daily?: DailyRecognition[];
  top_inmates?: TopInmate[];
  by_officer?: OfficerRecognition[];
  age_distribution?: DistributionEntry[];
  legal_status_distribution?: DistributionEntry[];
  facility_distribution?: DistributionEntry[];
}

// ---------- Officer ----------

// This now matches your FastAPI Pydantic models
export interface Officer {
  id: string;
  name: string;
  email: string;
  recognitions_today?: number; // optional, only if backend returns it
}

// For creating new officers (requires password)
export interface CreateOfficerRequest {
  name: string;
  email: string;
  password: string;
}
