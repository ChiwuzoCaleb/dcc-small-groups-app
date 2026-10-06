"use client";

import { useEffect, useMemo, useState } from "react";
import { reportCommentText } from "@/lib/api/reportComments";
import { colors, mono } from "@/lib/tokens";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SundayReport } from "@/lib/api/types";
import { StatusPill } from "@/components/leader/StatusPill";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { mostRecentSunday, formatServiceDate } from "@/lib/dates";
import { useMyReports, useMyReportsPage } from "@/hooks/api/reports";
import { ReportDetailDialog } from "@/components/leader/ReportDetailDialog";
import { useAuth } from "@/hooks/useAuth";
import { cellFrom, displayNameFrom } from "@/components/coordinator/kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function MyCellPage() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  const leaderName = displayNameFrom(user);
  const serviceDate = useMemo(
    () => mostRecentSunday(new Date()).toISOString().slice(0, 10),
    [],
  );
  // Every page, merged — feeds the stat cards, streak, attendance chart, and
  // the table's globally date-ordered rows.
  const mine = useMyReports();
  // Page 1 is tiny and arrives first, so the dashboard shows the latest report
  // while the full history is still loading. Shares its cache entry with the
  // table when it is on page 1 with no filter.
  const firstPage = useMyReportsPage(1);
  const reports = useMemo(
    () =>
      [...(mine.data ?? firstPage.data?.results ?? [])].sort((a, b) =>
        (b.service_date ?? "").localeCompare(a.service_date ?? ""),
      ),
    [mine.data, firstPage.data],
  );
  // Track the id, not the object, so the open dialog stays current across refetches.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The table itself shows exactly one server page; Next / Previous request
  // `reports/mine/?page=N` for that page.
  const [page, setPage] = useState(1);
  const [knownPageSize, setKnownPageSize] = useState<number | null>(null);
  // Service-date filter (YYYY-MM-DD, "" = none) — sent to the API as `?date=`.
  const [dateFilter, setDateFilter] = useState("");
  // What's typed in the picker. Kept apart from `dateFilter` because a native date
  // input reports a "valid" date while the year is still being typed (0002-…, 0020-…).
  const [dateDraft, setDateDraft] = useState("");
  const pageQuery = useMyReportsPage(page, dateFilter || undefined);
  const serverPageRows = pageQuery.data?.results ?? [];
  // The API doesn't state its page size; a page that has a `next` is a full page,
  // so its length is the size. Remembered on navigation so later pages can use it.
  const pageSize = knownPageSize ?? (serverPageRows.length || 1);
  // Rows come straight from the server page (already date-filtered by the API),
  // so the table renders without waiting for the full history.
  const pageRows = serverPageRows;
  const totalCount = pageQuery.data?.count ?? pageRows.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = rangeStart + pageRows.length - 1;
  const pageBusy = pageQuery.isFetching;

  function applyDateFilter(value: string) {
    setDateFilter(value);
    setPage(1); // a different result set — start from its first page
  }

  function onDateInput(value: string) {
    setDateDraft(value);
    if (value === "") applyDateFilter("");
    else if (value >= "2000-01-01" && value <= "2100-12-31")
      applyDateFilter(value);
  }

  function clearDateFilter() {
    setDateDraft("");
    applyDateFilter("");
  }

  function goToPage(target: number) {
    if (pageQuery.data?.next && pageRows.length > 0)
      setKnownPageSize(pageRows.length);
    setPage(target);
  }

  const current = reports.find((r) => r.service_date === serviceDate) ?? null;
  // A row may be clicked before the all-pages query has finished, so look on the
  // visible page first.
  const selected =
    pageRows.find((r) => r.id === selectedId) ??
    firstPage.data?.results.find((r) => r.id === selectedId) ??
    reports.find((r) => r.id === selectedId) ??
    null;

  // Consecutive most-recent weeks with a completed report. A rejected report is not complete.
  const streak = useMemo(() => {
    let n = 0;
    for (const r of reports) {
      if (r.approval_status === "DELETED" || r.approval_status === "REJECTED") break;
      n++;
    }
    return n;
  }, [reports]);

  const stats = useMemo(() => {
    const approved = reports.filter(
      (r) => r.approval_status === "APPROVED",
    ).length;
    const pending = reports.filter(
      (r) => r.approval_status === "PENDING",
    ).length;
    const attended = reports.filter((r) => (r.members_present ?? 0) > 0);
    const avgAttendance = attended.length
      ? Math.round(
          attended.reduce((sum, r) => sum + (r.members_present ?? 0), 0) /
            attended.length,
        )
      : 0;
    const totalOffering = reports.reduce(
      (sum, r) => sum + (r.total_offering ?? 0),
      0,
    );
    return { approved, pending, avgAttendance, totalOffering };
  }, [reports]);

  return (
    <>
      <PageHeader
        eyebrow={(() => { const c = cellFrom(user); const reportCell = (mine.data ?? []).find((r) => r.cell && typeof r.cell === "object" && r.cell.code)?.cell; const label = c.code ?? (reportCell && typeof reportCell === "object" ? reportCell.code : null) ?? c.name; return label ? `Cell Code · ${label}` : "My cell"; })()}
        title={`${greeting}${leaderName ? `, ${leaderName}` : ""}`}
        sub="Your Sunday reporting at a glance"
      />
      <div
        className="dcc-page"
        style={{
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 1100,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          <Card style={{ padding: 20, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Attendance, last reported 8 Sundays
            </div>
            {mine.isLoading ? (
              <Skeleton className="mt-4 h-24 w-full" />
            ) : reports.length === 0 ? (
              <div style={{ fontSize: 12.5, color: colors.faint, marginTop: 8 }}>
                No attendance recorded yet.
              </div>
            ) : (
              <AttendanceStrip reports={reports.slice(0, 8)} />
            )}
          </Card>

          {mine.isError ? (
            <Card
              style={{
                padding: 20,
                background: colors.redSoft,
                borderColor: colors.redSoftBorder,
              }}
            >
              <div style={{ fontSize: 13.5, color: colors.red }}>
                Could not load your reports: {mine.error.message}
              </div>
            </Card>
          ) : (
            <NextActionCard
              report={current}
              serviceDate={serviceDate}
              loading={mine.isLoading && firstPage.isLoading}
            />
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 12,
          }}
        >
          <StatCard
            label="Total submitted"
            value={String(
              dateFilter
                ? reports.length
                : (pageQuery.data?.count ?? reports.length),
            )}
            loading={
              dateFilter ? mine.isLoading : !pageQuery.data && mine.isLoading
            }
          />
          <StatCard
            label="Approved"
            value={String(stats.approved)}
            loading={mine.isLoading}
          />
          <StatCard
            label="Pending review"
            value={String(stats.pending)}
            loading={mine.isLoading}
          />
          <StatCard
            label="Reporting streak"
            value={`${streak} wk${streak === 1 ? "" : "s"}`}
            loading={mine.isLoading}
          />
          <StatCard
            label="Avg attendance"
            value={String(stats.avgAttendance)}
            loading={mine.isLoading}
          />
          <StatCard
            label="Offering recorded"
            value={naira.format(stats.totalOffering)}
            loading={mine.isLoading}
          />
        </div>

        <Card style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Submission record
            </div>
            {pageRows.length > 0 && (
              <div style={{ fontSize: 11.5, color: colors.faint }}>
                Select a row for full details
              </div>
            )}
          </div>
          {(totalCount > 0 || dateFilter) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <label
                htmlFor="report-date-filter"
                style={{ fontSize: 12, color: colors.muted }}
              >
                Service date
              </label>
              <Input
                id="report-date-filter"
                type="date"
                value={dateDraft}
                onChange={(e) => onDateInput(e.target.value)}
                className="h-8 w-auto text-sm"
              />
              {(dateFilter || dateDraft) && (
                <Button variant="ghost" size="sm" onClick={clearDateFilter}>
                  <X />
                  Clear
                </Button>
              )}
            </div>
          )}
          {pageQuery.isLoading ? (
            <SubmissionTableSkeleton />
          ) : pageQuery.isError && !pageQuery.data ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12.5, color: colors.red }}>
                Could not load page {page}: {pageQuery.error.message}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pageQuery.refetch()}
              >
                Retry
              </Button>
              {page > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                >
                  Back
                </Button>
              )}
              {dateFilter && (
                <Button variant="outline" size="sm" onClick={clearDateFilter}>
                  Clear filter
                </Button>
              )}
            </div>
          ) : totalCount === 0 ? (
            <div style={{ fontSize: 12.5, color: colors.faint }}>
              {dateFilter
                ? `No report found for ${dateFilter}.`
                : "No reports submitted yet."}
            </div>
          ) : (
            <>
              {/* While the next page loads, the previous one stays up, dimmed. */}
              <div
                style={{
                  opacity: pageQuery.isPlaceholderData ? 0.55 : 1,
                  transition: "opacity 120ms",
                }}
              >
                <SubmissionTable
                  rows={pageRows}
                  onSelect={(r) => setSelectedId(r.id)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 14,
                }}
              >
                <div style={{ fontSize: 12, color: colors.muted }}>
                  {pageQuery.isPlaceholderData
                    ? `Loading page ${page}…`
                    : `Showing ${rangeStart}–${rangeEnd} of ${totalCount}${dateFilter ? " for this date" : ""}`}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || pageBusy}
                    aria-label="Previous page"
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <span
                    style={{
                      fontSize: 12,
                      color: colors.muted,
                      minWidth: 74,
                      textAlign: "center",
                    }}
                  >
                    Page {page} of {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(page + 1)}
                    disabled={!pageQuery.data?.next || pageBusy}
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

      </div>

      <ReportDetailDialog
        report={selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </>
  );
}

type Align = "left" | "right";
const SUBMISSION_COLUMNS: { key: string; label: string; align: Align }[] = [
  { key: "date", label: "Service date", align: "left" },
  { key: "meeting", label: "Meeting", align: "left" },
  { key: "members", label: "Members", align: "right" },
  { key: "guests", label: "Guest cards", align: "right" },
  { key: "offering", label: "Offering", align: "right" },
  { key: "status", label: "Status", align: "right" },
];

function formatSubmissionServiceDate(serviceDate: string) {
  const [year, month, day] = serviceDate.split("-");
  return `${day}-${month}-${year}`;
}

function alignClass(align: Align) {
  return align === "right" ? "text-right" : undefined;
}

function HeaderRow() {
  return (
    <TableHeader>
      <TableRow>
        {SUBMISSION_COLUMNS.map((c) => (
          <TableHead key={c.key} className={alignClass(c.align)}>
            {c.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function SubmissionTable({
  rows,
  onSelect,
}: {
  rows: SundayReport[];
  onSelect: (r: SundayReport) => void;
}) {
  return (
    <Table>
      <HeaderRow />
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            tabIndex={0}
            aria-haspopup="dialog"
            aria-label={`View details for ${r.service_date ?? "report"}`}
            className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none"
            onClick={() => onSelect(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r);
              }
            }}
          >
            <TableCell className="font-medium">
              {r.service_date
                ? formatSubmissionServiceDate(r.service_date)
                : "—"}
            </TableCell>
            <TableCell
              className={
                r.meeting_held === false
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            >
              {r.meeting_held === false
                ? "Not held"
                : r.meeting_held
                  ? "Held"
                  : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.members_present ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.guests_cards ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {r.total_offering != null ? naira.format(r.total_offering) : "—"}
            </TableCell>
            <TableCell className="text-right">
              <StatusPill status={r.approval_status} source={r.source} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SubmissionTableSkeleton({ rows = 5 }: { rows?: number }) {
  const widths = ["w-20", "w-14", "w-8", "w-8", "w-16", "w-16"];
  return (
    <Table>
      <HeaderRow />
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            {SUBMISSION_COLUMNS.map((c, j) => (
              <TableCell key={c.key}>
                <Skeleton
                  className={`h-4 ${widths[j]} ${c.align === "right" ? "ml-auto" : ""} ${
                    c.key === "status" ? "h-5 rounded-full" : ""
                  }`}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            fontFamily: mono,
            color: colors.ink,
          }}
        >
          {value}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: colors.muted, marginTop: 4 }}>
        {label}
      </div>
    </Card>
  );
}

/** Oldest-to-newest attendance bars, the most recent Sunday picked out in red. */
function AttendanceStrip({ reports }: { reports: SundayReport[] }) {
  const chronological = [...reports].reverse();
  const max = Math.max(1, ...chronological.map((r) => r.members_present ?? 0));

  return (
    <div style={{ marginTop: 16, overflowX: "auto", paddingBottom: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 5,
          height: 110,
          minWidth: chronological.length * 52,
        }}
      >
        {chronological.map((r, i) => {
          const value = r.members_present ?? 0;
          const isLatest = i === chronological.length - 1;
          return (
            <div
              key={r.id}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: mono,
                  color: isLatest ? colors.red : colors.muted,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  minHeight: 3,
                  height: `${Math.max(4, (value / max) * 64)}px`,
                  background: isLatest ? colors.red : colors.hairline,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: colors.faint2,
                  whiteSpace: "nowrap",
                }}
              >
                {r.service_date
                  ? formatServiceDate(new Date(r.service_date))
                  : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NextActionCard({
  report,
  serviceDate,
  loading,
}: {
  report: SundayReport | null;
  serviceDate: string;
  loading: boolean;
}) {
  const dueLabel = `${formatServiceDate(new Date(serviceDate))} report`;
  const longDueDate = new Date(`${serviceDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  if (loading) {
    return (
      <Card style={{ padding: 20 }}>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-4 w-64" />
      </Card>
    );
  }

  if (report?.approval_status === "REJECTED") {
    return (
      <Card
        style={{
          padding: 20,
          borderColor: colors.redSoftBorder,
          background: colors.redSoft,
        }}
      >
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: colors.red,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Sent back
        </div>
        <div style={{ fontSize: 14, marginTop: 6, marginBottom: 10 }}>
          {reportCommentText(report) || "Your approver asked for a correction."}
        </div>
        <LinkButton href="/cell/report" variant="primary">
          Edit and resubmit
        </LinkButton>
      </Card>
    );
  }

  if (report?.approval_status === "PENDING") {
    return (
      <Card style={{ padding: 20 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: colors.amber,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Submitted
        </div>
        <div style={{ fontSize: 14, marginTop: 6 }}>
          {dueLabel} is waiting on your Section Leader for approval.
        </div>
      </Card>
    );
  }

  if (report?.approval_status === "APPROVED") {
    return (
      <Card style={{ padding: 20 }}>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: colors.green,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          Approved
        </div>
        <div style={{ fontSize: 14, marginTop: 6 }}>
          {dueLabel} was approved. Nothing due right now.
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 20, borderColor: colors.redSoftBorder, background: "#FFFCFC" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: colors.red, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.red }}>
          Report due
        </span>
      </div>
      <div style={{ fontSize: 20, lineHeight: 1.3, fontWeight: 600, marginBottom: 7 }}>
        Your {longDueDate} report is not in yet
      </div>
      <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.6, marginBottom: 18 }}>
        Complete your Sunday report in a few short steps.
      </div>
      <LinkButton href="/cell/report" variant="primary">
        Start report
      </LinkButton>
    </Card>
  );
}
