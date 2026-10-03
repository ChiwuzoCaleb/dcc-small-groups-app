"use client";

/** Typed hooks for `/api/v1/reports/…`. */

import { API_ROUTES } from "@/lib/api/config";
import { api } from "@/lib/api/client";
import { useMutation } from "@tanstack/react-query";
import type {
  CreateReportInput,
  Paginated,
  ReportDecisionInput,
  SundayReport,
  UpdateReportInput,
  WhatsAppReportInput,
} from "@/lib/api/types";
import {
  ApiError,
  queryKeys,
  useApiAllPagesQuery,
  useApiInfiniteQuery,
  useApiMutation,
  useApiQuery,
  type QueryParams,
} from "../useApi";

/** Download a scoped Excel export of the reports for one service date (`POST reports/export/`). */
export function useExportReports() {
  return useMutation<void, ApiError, { date: string; regionId: string }>({
    mutationFn: async ({ date, regionId }) => {
      const { blob } = await api.download(API_ROUTES.reportsExport, {
        method: "POST",
        body: { date, region_id: regionId },
      });
      const xlsx = new Blob([blob], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const [y, m, d] = date.split("-");
      const name = `DCC Sunday Report - ${d}-${m}-${y}.xlsx`;
      const url = URL.createObjectURL(xlsx);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
}

/** Paginated list of reports in the caller's scope. */
export function useReports(params?: { page?: number } & QueryParams) {
  return useApiQuery<Paginated<SundayReport>>(
    queryKeys.reports.list(params),
    API_ROUTES.reports,
    { params, placeholderData: (prev) => prev },
  );
}

/** All reports visible to the signed-in leader, loaded only when a cell detail is opened. */
export function useScopedReportsForCell(enabled: boolean) {
  return useApiAllPagesQuery<SundayReport>(
    queryKeys.reports.all,
    API_ROUTES.reports,
    { query: { enabled } },
  );
}

/** Same list, as an infinite query for "load more" UIs. */
export function useInfiniteReports(params?: QueryParams) {
  return useApiInfiniteQuery<SundayReport>(
    queryKeys.reports.list({ ...params, infinite: true }),
    API_ROUTES.reports,
    { params },
  );
}

/**
 * Every report submitted by the current Cell Leader. `reports/mine/` is
 * paginated (`count` / `next` / `results`), and the dashboard derives totals,
 * streaks and averages from this list — so all pages are fetched and merged,
 * not just the first.
 */
export function useMyReports() {
  return useApiAllPagesQuery<SundayReport>(queryKeys.reports.mine, API_ROUTES.myReports);
}

/**
 * Exactly one server page of the caller's reports (`reports/mine/?page=N`) —
 * what the Submission record table shows. The previous page stays on screen
 * while the next one loads. Order is whatever the API returns (newest
 * submitted first), so the table is not re-sorted client-side.
 *
 * `date` (YYYY-MM-DD) is the API's only filter here: it narrows the list to
 * reports for that service date.
 */
export function useMyReportsPage(page: number, date?: string) {
  return useApiQuery<Paginated<SundayReport> | SundayReport[], Paginated<SundayReport>>(
    queryKeys.reports.minePage(page, date),
    API_ROUTES.myReports,
    {
      params: { page, ...(date ? { date } : {}) },
      placeholderData: (prev) => prev,
      // Tolerate an unpaginated (bare array) response.
      select: (d) =>
        Array.isArray(d) ? { count: d.length, next: null, previous: null, results: d } : d,
    },
  );
}

export function useReport(id: string | null) {
  return useApiQuery<SundayReport>(
    id ? queryKeys.reports.detail(id) : ["reports", "detail", "nil"],
    id ? API_ROUTES.report(id) : null,
  );
}

/** Create this Sunday's report for the authenticated Cell Leader's cell. */
export function useCreateReport() {
  return useApiMutation<SundayReport, CreateReportInput>(API_ROUTES.reports, {
    method: "POST",
    invalidateKeys: [queryKeys.reports.all, queryKeys.dashboard.all],
  });
}

/** Submit on behalf of a cell identified by `cell_code` (the WhatsApp channel). */
export function useCreateWhatsAppReport() {
  return useApiMutation<SundayReport, WhatsAppReportInput>(API_ROUTES.reportWhatsapp, {
    method: "POST",
    invalidateKeys: [queryKeys.reports.all, queryKeys.dashboard.all],
  });
}

/** Edit a REJECTED report before resubmitting (only the submitting Cell Leader may). */
export function useUpdateReport(id: string) {
  return useApiMutation<SundayReport, UpdateReportInput>(
    (body) => ({ path: API_ROUTES.report(id), method: "PATCH", body }),
    { invalidateKeys: [queryKeys.reports.all, queryKeys.dashboard.all] },
  );
}

export function useApproveReport() {
  return useApiMutation<SundayReport, { id: string } & ReportDecisionInput>(
    ({ id, ...body }) => ({ path: API_ROUTES.reportApprove(id), method: "POST", body }),
    { invalidateKeys: [queryKeys.reports.all, queryKeys.approvals.all, queryKeys.dashboard.all] },
  );
}

/** Send a report back for correction, with an optional explanatory comment. */
export function useRejectReport() {
  return useApiMutation<SundayReport, { id: string } & ReportDecisionInput>(
    ({ id, ...body }) => ({ path: API_ROUTES.reportReject(id), method: "POST", body }),
    { invalidateKeys: [queryKeys.reports.all, queryKeys.approvals.all, queryKeys.dashboard.all] },
  );
}
