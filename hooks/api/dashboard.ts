"use client";

/** Typed hooks for `/api/v1/organization/dashboard/…`. */

import { API_ROUTES } from "@/lib/api/config";
import type {
  ApprovalWaitItem,
  ComplianceScope,
  ComplianceSummary,
  NonSubmitterRow,
  OrgUnitType,
} from "@/lib/api/types";
import { api } from "@/lib/api/client";
import { asArray, asObject } from "@/lib/api/normalize";
import { queryKeys, useApiQuery } from "../useApi";

/**
 * Compliance totals for the caller's scope as a single {@link ComplianceSummary}.
 * `serviceDate` is a Sunday (YYYY-MM-DD); the latest closed Sunday is used when
 * omitted. (The schema says this is an array — the live endpoint returns one object.)
 */
export function useOrgDashboard(serviceDate?: string) {
  const params = serviceDate ? { service_date: serviceDate } : undefined;
  return useApiQuery<unknown, ComplianceSummary>(
    queryKeys.dashboard.summary(params),
    API_ROUTES.orgDashboard,
    { params, select: (d) => asObject<ComplianceSummary>(d) },
  );
}

/** Compliance for one specific unit (region…cell). Only the caller's own level or descendants. */
export function useUnitDashboard(
  unitType: OrgUnitType | null,
  id: string | null,
  serviceDate?: string,
) {
  const params = serviceDate ? { service_date: serviceDate } : undefined;
  const enabled = !!unitType && !!id;
  return useApiQuery<ComplianceScope>(
    queryKeys.dashboard.unit(unitType ?? "nil", id ?? "nil", params),
    enabled ? API_ROUTES.orgDashboardUnit(unitType!, id!) : null,
    { params },
  );
}

/** Pending reports the caller can act on, with waiting duration + overdue flags. Bare array upstream. */
export function useDashboardApprovals() {
  return useApiQuery<unknown, ApprovalWaitItem[]>(
    queryKeys.dashboard.approvals,
    API_ROUTES.orgDashboardApprovals,
    { select: (d) => asArray<ApprovalWaitItem>(d), refetchInterval: 60_000 },
  );
}

/** Total pending approvals, preserving DRF's paginated `count` when present. */
export function useDashboardApprovalCount() {
  return useApiQuery<unknown, number | null>(
    queryKeys.dashboard.approvals,
    API_ROUTES.orgDashboardApprovals,
    {
      select: (data) => {
        if (Array.isArray(data)) return data.length;
        if (data && typeof data === "object") {
          const page = data as { count?: unknown; results?: unknown };
          if (typeof page.count === "number") return page.count;
          if (Array.isArray(page.results)) return page.results.length;
        }
        return null;
      },
      refetchInterval: 60_000,
    },
  );
}

/** Cells in scope that have not submitted for the selected Sunday. `chronic` → missing 3+ consecutive Sundays. */
export function useNonSubmitters(opts: { serviceDate?: string; chronic?: boolean } = {}) {
  const params = {
    ...(opts.serviceDate ? { service_date: opts.serviceDate } : {}),
    ...(opts.chronic ? { chronic: true } : {}),
  };
  return useApiQuery<unknown, NonSubmitterRow[]>(
    queryKeys.dashboard.nonSubmitters(params),
    API_ROUTES.orgDashboardNonSubmitters,
    { params, select: (d) => asArray<NonSubmitterRow>(d) },
  );
}

/** One backend-paginated page of non-submitting cells; the API default page size is 10. */
export function useNonSubmitterPage(opts: { serviceDate?: string; chronic?: boolean; page: number }) {
  const params = {
    ...(opts.serviceDate ? { service_date: opts.serviceDate } : {}),
    ...(opts.chronic ? { chronic: true } : {}),
    page: opts.page,
  };
  return useApiQuery<unknown, { rows: NonSubmitterRow[]; count: number }>(
    queryKeys.dashboard.nonSubmitters(params),
    API_ROUTES.orgDashboardNonSubmitters,
    {
      params,
      select: (data) => {
        if (Array.isArray(data)) return { rows: data as NonSubmitterRow[], count: data.length };
        if (data && typeof data === "object") {
          const page = data as { count?: unknown; results?: unknown };
          if (Array.isArray(page.results)) {
            return {
              rows: page.results as NonSubmitterRow[],
              count: typeof page.count === "number" ? page.count : page.results.length,
            };
          }
        }
        return { rows: [], count: 0 };
      },
    },
  );
}

/** Total non-submitters or chronic cells, preserving DRF's paginated count. */
export function useNonSubmitterCount(opts: { serviceDate?: string; chronic?: boolean } = {}) {
  const params = {
    ...(opts.serviceDate ? { service_date: opts.serviceDate } : {}),
    ...(opts.chronic ? { chronic: true } : {}),
  };
  return useApiQuery<unknown, number | null>(
    queryKeys.dashboard.nonSubmitters(params),
    API_ROUTES.orgDashboardNonSubmitters,
    {
      params,
      select: (data) => {
        if (Array.isArray(data)) return data.length;
        if (data && typeof data === "object") {
          const page = data as { count?: unknown; results?: unknown };
          if (typeof page.count === "number") return page.count;
          if (Array.isArray(page.results)) return page.results.length;
        }
        return null;
      },
    },
  );
}

/** One compliance summary per Sunday over the last `weeks` (the API accepts 4, 8, or 12). Array upstream. */
export function useComplianceTrends(weeks: 4 | 8 | 12 = 8) {
  const params = { weeks };
  return useApiQuery<unknown, ComplianceSummary[]>(
    queryKeys.dashboard.trends(params),
    API_ROUTES.orgDashboardTrends,
    { params, select: (d) => asArray<ComplianceSummary>(d) },
  );
}

/** Download a scoped CSV export for an inclusive date range (both dates required, YYYY-MM-DD). */
export function useDashboardExport() {
  return {
    async download(startDate: string, endDate: string) {
      const { blob, filename } = await api.download(API_ROUTES.orgDashboardExport, {
        query: { start_date: startDate, end_date: endDate },
      });
      return { blob, filename: filename ?? `dcc-export-${startDate}_${endDate}.csv` };
    },
  };
}
