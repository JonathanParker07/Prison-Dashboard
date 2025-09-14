// hooks/useLogs.ts
import useSWR from "swr";
import { swrFetcher } from "@/services/api";

// --- Types ---
export interface DailyRecognition {
  date: string;
  count: number;
}

export interface TopInmate {
  inmate_id: string;
  name: string;
  count: number;
}

export interface RecognitionsByOfficer {
  officer: string;
  count: number;
}

export interface VerificationLog {
  id: string;
  inmate_id: string;
  inmate_name: string;
  officer: string;
  timestamp: string;
}

export interface DistributionItem {
  label: string;
  count: number;
}

// --- Hooks ---

// Daily recognitions over N days
export function useDailyRecognitions(days = 7) {
  return useSWR<DailyRecognition[]>(
    `/stats/recognitions-daily?days=${days}`,
    swrFetcher
  );
}

// Top inmates over N days
export function useTopInmates(days = 30) {
  return useSWR<TopInmate[]>(
    `/stats/top-inmates?days=${days}`,
    swrFetcher
  );
}

// Recognitions grouped by officer
export function useRecognitionsByOfficer() {
  return useSWR<RecognitionsByOfficer[]>(
    `/stats/recognitions-by-officer`,
    swrFetcher
  );
}

// Recent verifications (latest N)
export function useRecentVerifications(limit = 5) {
  return useSWR<VerificationLog[]>(
    `/stats/recent-verifications?limit=${limit}`,
    swrFetcher
  );
}

// Age distribution
export function useAgeDistribution() {
  return useSWR<DistributionItem[]>(
    `/stats/age-distribution`,
    swrFetcher
  );
}

// Legal status distribution
export function useLegalStatusDistribution() {
  return useSWR<DistributionItem[]>(
    `/stats/legal-status-distribution`,
    swrFetcher
  );
}

// Facility distribution
export function useFacilityDistribution() {
  return useSWR<DistributionItem[]>(
    `/stats/facility-distribution`,
    swrFetcher
  );
}

// Sex distribution
export function useSexDistribution() {
  return useSWR<DistributionItem[]>(
    `/stats/sex-distribution`,
    swrFetcher
  );
}

// Example usage in a component:
// const { data: daily } = useDailyRecognitions(14);
// const { data: topInmates } = useTopInmates(30);
