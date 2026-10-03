"use client";

/** Typed hooks for `/api/v1/approvals/…` and `/api/v1/approval-settings/`. */

import { API_ROUTES } from "@/lib/api/config";
import type { ApprovalSettings, SundayReport } from "@/lib/api/types";
import { asArray } from "@/lib/api/normalize";
import { useMemo } from "react";
import { queryKeys, useApiAllPagesQuery, useApiMutation, useApiQuery } from "../useApi";

/**
 * Pending reports the signed-in approver can act on.
 *
 * `approvals/queue/` is the primary source, but the API leaves out reports it
 * has stamped with a Section Leader's decision — e.g. a rejected report the Cell
 * Leader has since resubmitted — so higher approvers never see them. Every
 * approver level (Section → Region) must be able to act on any PENDING report
 * in their scope, so the queue is merged with the PENDING rows of `reports/`.
 */
export function useApprovalsQueue(enabled = true) {
  const queue = useApiQuery<unknown, SundayReport[]>(queryKeys.approvals.queue, API_ROUTES.approvalsQueue, {
    select: (d) => asArray<SundayReport>(d),
    refetchInterval: 60_000,
  });
  const scoped = useApiAllPagesQuery<SundayReport>(queryKeys.reports.list({ for: "approvals" }), API_ROUTES.reports, {
    query: { enabled, refetchInterval: 60_000 },
  });

  const data = useMemo(() => {
    if (!queue.data || scoped.isLoading) return undefined;
    const byId = new Map<string, SundayReport>();
    for (const r of queue.data) byId.set(r.id, r);
    for (const r of scoped.data ?? []) {
      if (r.approval_status === "PENDING" && !byId.has(r.id)) byId.set(r.id, r);
    }
    return [...byId.values()];
  }, [queue.data, scoped.data, scoped.isLoading]);

  return {
    data,
    isLoading: queue.isLoading || scoped.isLoading,
    isError: queue.isError,
    error: queue.error as Error | null,
  };
}

export function useApprovalSettings() {
  return useApiQuery<ApprovalSettings>(queryKeys.approvals.settings, API_ROUTES.approvalSettings);
}

/** PATCH the seconds-before-fallback-approval interval. */
export function useUpdateApprovalSettings() {
  return useApiMutation<ApprovalSettings, Partial<ApprovalSettings>>(
    (body) => ({ path: API_ROUTES.approvalSettings, method: "PATCH", body }),
    { invalidateKeys: [queryKeys.approvals.settings] },
  );
}
