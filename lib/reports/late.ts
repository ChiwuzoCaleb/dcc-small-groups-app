import type { SundayReport } from "@/lib/api/types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** True when a report was submitted more than a week after its service (due) date; such reports can only be approved, not sent back. */
export function isLateSubmission(report: Pick<SundayReport, "service_date" | "date_created"> | null | undefined): boolean {
  if (!report?.service_date || !report.date_created) return false;
  const due = Date.parse(`${report.service_date}T00:00:00Z`);
  const submitted = Date.parse(report.date_created);
  if (Number.isNaN(due) || Number.isNaN(submitted)) return false;
  return submitted - due > WEEK_MS;
}