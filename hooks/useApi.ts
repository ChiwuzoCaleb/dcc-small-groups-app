"use client";

/**
 * useApi — the single custom hook layer for talking to the DCC API.
 *
 * Everything goes through the same-origin BFF proxy (`lib/api/client.ts`),
 * which attaches the JWT from an httpOnly cookie. These hooks add TanStack
 * Query on top: caching, dedup, background refetch, retry policy (defined in
 * `components/providers/QueryProvider.tsx`), and typed errors (`ApiError`).
 *
 *   const reports = useApiQuery<Paginated<SundayReport>>(
 *     queryKeys.reports.list({ page }),
 *     API_ROUTES.reports,
 *     { params: { page } },
 *   );
 *
 *   const approve = useApiMutation<SundayReport, { id: string }>(
 *     ({ id }) => ({ path: API_ROUTES.reportApprove(id), method: "POST" }),
 *     { invalidateKeys: [queryKeys.reports.all, queryKeys.approvals.all] },
 *   );
 *
 * Resource-specific wrappers live in `hooks/api/*`.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseInfiniteQueryOptions,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback } from "react";
import { api, type ApiCallOptions } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { asArray, unwrapData } from "@/lib/api/normalize";
import type { QueryParams } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";

export { ApiError };
export type { QueryParams };

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ---------------------------------------------------------------------------
// Query-key factory — keeps cache keys consistent and greppable.
// ---------------------------------------------------------------------------

export const queryKeys = {
  session: ["session"] as const,

  reports: {
    all: ["reports"] as const,
    list: (params?: QueryParams) => ["reports", "list", params ?? {}] as const,
    mine: ["reports", "mine"] as const,
    byDate: (date: string) => ["reports", "mine", "date", date] as const,
    /** One server page of `reports/mine/`. Shares the `mine` prefix so invalidating `reports.all` refreshes it too. */
    minePage: (page: number, date?: string) => ["reports", "mine", "page", page, date ?? null] as const,
    detail: (id: string) => ["reports", "detail", id] as const,
  },
  approvals: {
    all: ["approvals"] as const,
    queue: ["approvals", "queue"] as const,
    settings: ["approvals", "settings"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    summary: (params?: QueryParams) => ["dashboard", "summary", params ?? {}] as const,
    unit: (unitType: string, id: string, params?: QueryParams) =>
      ["dashboard", "unit", unitType, id, params ?? {}] as const,
    approvals: ["dashboard", "approvals"] as const,
    nonSubmitters: (params?: QueryParams) => ["dashboard", "non-submitters", params ?? {}] as const,
    trends: (params?: QueryParams) => ["dashboard", "trends", params ?? {}] as const,
  },
  roles: {
    all: ["roles"] as const,
    list: (params?: QueryParams) => ["roles", "list", params ?? {}] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (params?: QueryParams) => ["notifications", "list", params ?? {}] as const,
  },
} as const;

// ---------------------------------------------------------------------------
// useApiQuery
// ---------------------------------------------------------------------------

export interface UseApiQueryOptions<TData, TSelected>
  extends Omit<UseQueryOptions<TData, ApiError, TSelected, QueryKey>, "queryKey" | "queryFn"> {
  /** Query-string params for the request. */
  params?: QueryParams;
  /** Extra per-request options (timeout, signal is managed for you). */
  request?: ApiCallOptions;
}

/**
 * GET `path` and cache it under `key`. Pass `path = null` to keep the query
 * disabled (dependent queries) without violating the rules of hooks.
 */
export function useApiQuery<TData = unknown, TSelected = TData>(
  key: QueryKey,
  path: string | null,
  options: UseApiQueryOptions<TData, TSelected> = {},
): UseQueryResult<TSelected, ApiError> {
  const { params, request, ...queryOptions } = options;

  return useQuery<TData, ApiError, TSelected, QueryKey>({
    queryKey: key,
    queryFn: ({ signal }) =>
      api.get<TData>(path as string, { ...request, query: params, signal }),
    enabled: path !== null && (queryOptions.enabled ?? true),
    ...queryOptions,
  });
}

// ---------------------------------------------------------------------------
// useApiInfiniteQuery — DRF PageNumberPagination (`?page=`, `next`, `previous`)
// ---------------------------------------------------------------------------

function pageFromUrl(url: string | null): number | undefined {
  if (!url) return undefined;
  try {
    const value = new URL(url, "http://x").searchParams.get("page");
    return value ? Number(value) : undefined;
  } catch {
    return undefined;
  }
}

export function useApiInfiniteQuery<TItem>(
  key: QueryKey,
  path: string,
  options: {
    params?: QueryParams;
    pageParamName?: string;
    query?: Omit<
      UseInfiniteQueryOptions<
        Paginated<TItem>,
        ApiError,
        { pages: Paginated<TItem>[]; pageParams: number[] },
        QueryKey,
        number
      >,
      "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
    >;
  } = {},
) {
  const { params, pageParamName = "page", query } = options;

  return useInfiniteQuery({
    queryKey: key,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<TItem>>(path, {
        query: { ...params, [pageParamName]: pageParam },
        signal,
      }),
    getNextPageParam: (lastPage) => pageFromUrl(lastPage.next),
    getPreviousPageParam: (firstPage) => pageFromUrl(firstPage.previous),
    ...query,
  });
}

// ---------------------------------------------------------------------------
// useApiAllPagesQuery — fetch *every* page of a paginated list into one array
// ---------------------------------------------------------------------------

/**
 * For lists that are small enough to hold in memory and that the UI derives
 * totals from (counts, streaks, averages) — those are wrong if only page 1 is
 * loaded. Follows `next` until it runs out, and also accepts an endpoint that
 * returns a bare array. `maxPages` is a runaway guard, not an expected limit.
 */
export function useApiAllPagesQuery<TItem>(
  key: QueryKey,
  path: string,
  options: {
    params?: QueryParams;
    maxPages?: number;
    query?: Omit<UseQueryOptions<TItem[], ApiError, TItem[], QueryKey>, "queryKey" | "queryFn">;
  } = {},
): UseQueryResult<TItem[], ApiError> {
  const { params, maxPages = 50, query } = options;

  return useQuery<TItem[], ApiError, TItem[], QueryKey>({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const fetchPage = (page: number) =>
        api.get<Paginated<TItem> | TItem[]>(path, { query: { ...params, page }, signal });

      const first = await fetchPage(1);
      const items = asArray<TItem>(first);
      if (Array.isArray(first) || first.next == null) return items;

      // Page 1 tells us the total and page size, so the remaining pages can be
      // requested in parallel instead of one round trip after another.
      const pageSize = items.length;
      const total = typeof first.count === "number" ? first.count : 0;
      if (pageSize > 0 && total > pageSize) {
        const last = Math.min(Math.ceil(total / pageSize), maxPages);
        const rest = await Promise.all(
          Array.from({ length: last - 1 }, (_, i) => fetchPage(i + 2)),
        );
        for (const body of rest) items.push(...asArray<TItem>(body));
        return items;
      }

      // No usable count: fall back to following `next`.
      let page = pageFromUrl(first.next);
      for (let i = 1; page !== undefined && i < maxPages; i++) {
        const body: Paginated<TItem> | TItem[] = await fetchPage(page);
        items.push(...asArray<TItem>(body));
        const next: number | undefined = Array.isArray(body) ? undefined : pageFromUrl(body.next);
        page = next !== undefined && next > page ? next : undefined;
      }
      return items;
    },
    ...query,
  });
}

// ---------------------------------------------------------------------------
// useApiMutation
// ---------------------------------------------------------------------------

export interface MutationTarget {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  request?: ApiCallOptions;
}

export interface UseApiMutationOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, ApiError, TVariables>, "mutationFn"> {
  /** Default method when `resolver` is a bare path string. Defaults to POST. */
  method?: HttpMethod;
  /** Query keys to invalidate after a successful mutation. */
  invalidateKeys?: QueryKey[];
}

/**
 * `resolver` is either a fixed path (the variables become the request body) or
 * a function mapping variables → `{ path, method, body }` for dynamic routes
 * like `reports/{id}/approve/`.
 */
export function useApiMutation<TData = unknown, TVariables = void>(
  resolver: string | ((variables: TVariables) => MutationTarget),
  options: UseApiMutationOptions<TData, TVariables> = {},
): UseMutationResult<TData, ApiError, TVariables> {
  const queryClient = useQueryClient();
  const { method: defaultMethod = "POST", invalidateKeys, onSuccess, ...mutationOptions } = options;

  const mutationFn = useCallback(
    async (variables: TVariables): Promise<TData> => {
      const target: MutationTarget =
        typeof resolver === "string"
          ? { path: resolver, method: defaultMethod, body: variables }
          : resolver(variables);
      const method = target.method ?? defaultMethod;
      const req = target.request;

      let raw: unknown;
      switch (method) {
        case "GET":
          raw = await api.get(target.path, req);
          break;
        case "DELETE":
          raw = await api.delete(target.path, req);
          break;
        case "PUT":
          raw = await api.put(target.path, target.body, req);
          break;
        case "PATCH":
          raw = await api.patch(target.path, target.body, req);
          break;
        default:
          raw = await api.post(target.path, target.body, req);
      }
      // Auth-style endpoints wrap the payload in `{ message, data }`; resource
      // endpoints don't. `unwrapData` is a no-op for the latter.
      return unwrapData<TData>(raw);
    },
    [resolver, defaultMethod],
  );

  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: async (...args: Parameters<NonNullable<typeof onSuccess>>) => {
      if (invalidateKeys?.length) {
        // Refetch in the background so callers (and their success toasts) aren't
        // held up by slow list queries once the server has confirmed the change.
        void Promise.all(
          invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        ).catch(() => undefined);
      }
      await onSuccess?.(...args);
    },
    ...mutationOptions,
  });
}

// ---------------------------------------------------------------------------
// Imperative escape hatch
// ---------------------------------------------------------------------------

/** The raw client plus the query client, for one-off calls outside the hook model. */
export function useApiClient() {
  const queryClient = useQueryClient();
  return { api, queryClient };
}
