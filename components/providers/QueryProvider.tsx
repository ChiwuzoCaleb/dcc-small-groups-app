"use client";

/**
 * App-wide TanStack Query provider. Mount once, high in the tree
 * (see `app/layout.tsx`).
 *
 * Defaults are tuned for this app: dashboards tolerate ~30s stale data, we
 * never retry a 4xx (a 400/401/403/404 won't fix itself), and we do retry
 * transient 5xx / network blips twice with backoff — Render's free tier
 * cold-starts.
 */

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

const RETRYABLE = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) return RETRYABLE.has(error.status);
  return true; // unknown / network error
}

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: shouldRetry,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: false,
  },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
