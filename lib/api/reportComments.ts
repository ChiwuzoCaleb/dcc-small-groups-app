import type { ReportComment, SundayReport } from "./types";

/** Newest entry of the report's `comments` history, or null. */
export function latestReportComment(report: Pick<SundayReport, "comments"> | null | undefined): ReportComment | null {
  const list = report?.comments ?? [];
  return list.reduce<ReportComment | null>(
    (best, c) => (!best || c.commented_at >= best.commented_at ? c : best),
    null,
  );
}

/** The report's current note: the latest comment, falling back to the legacy `comment` string. */
export function reportCommentText(report: Pick<SundayReport, "comments" | "comment"> | null | undefined): string {
  return latestReportComment(report)?.comment || report?.comment || "";
}

/** Full comment history, oldest first. A legacy single `comment` string is shown as one undated entry. */
export function allReportComments(report: Pick<SundayReport, "comments" | "comment"> | null | undefined): ReportComment[] {
  const list = [...(report?.comments ?? [])].sort((a, b) => a.commented_at.localeCompare(b.commented_at));
  if (list.length === 0 && report?.comment) {
    return [{ comment: report.comment, commented_at: "", commented_by: "" }];
  }
  return list;
}
