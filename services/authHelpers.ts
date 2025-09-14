// services/authHelpers.ts
import { useAuth } from "@/contexts/AuthContext";

export function getToken(): string | null {
  // Try to read from localStorage in case outside React lifecycle
  if (typeof window !== "undefined") {
    const localToken = localStorage.getItem("token");
    if (localToken) return localToken;
  }
  return null;
}
