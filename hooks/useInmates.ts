// hooks/useInmates.ts
import useSWR from "swr";
import { swrFetcher } from "@/services/api";
import type { InmateOut } from "@/types";

export function useInmates() {
  const { data, error, isLoading, mutate } = useSWR<InmateOut[]>(
    "/inmates/",
    swrFetcher
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

export function useInmate(id?: string) {
  return useSWR<InmateOut>(id ? `/inmates/${id}` : null, swrFetcher);

}