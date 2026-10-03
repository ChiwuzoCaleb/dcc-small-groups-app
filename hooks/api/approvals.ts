"use client";

/** Typed hooks for `/api/v1/approvals/…` and `/api/v1/approval-settings/`. */

import { API_ROUTES } from "@/lib/api/config";
import type { ApprovalSettings, SundayReport } from "@/lib/api/types";
import { queryKeys, useApiAllPagesQuery, useApiMutation, useApiQuery } from "../useApi";

/**
 * Pending reports the signed-in approver can act on right now.
 *
 * `approvals/queue/` is already filtered server-side through `can_approve()`
 * (section leaders immediately, higher levels after the configured deadline),
 * so it is the single source of truth — no client-side scan of `reports/`.
 * All pages are fetched in parallel; the list refreshes every minute while the
 * tab is visible.
 */
export function useApprovalsQueue(enabled = true) {
  return useApiAllPagesQuery<SundayReport>(queryKeys.approvals.queue, API_ROUTES.approvalsQueue, {
    query: { enabled, refetchInterval: 60_000 },
  });
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
