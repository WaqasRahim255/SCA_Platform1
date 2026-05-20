import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";
import type { HealthResponse } from "@/types/api";

export function useHealthCheck() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    apiFetch<HealthResponse>("/health")
      .then(setData)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught : new Error("Unknown API error"));
      });
  }, []);

  return { data, error, isLoading: !data && !error };
}

