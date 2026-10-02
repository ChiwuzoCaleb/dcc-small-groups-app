"use client";

import { useMemo, useState } from "react";
import { PageHeader, Card, Button, TextArea } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { colors, mono } from "@/lib/tokens";
import { formatServiceDate } from "@/lib/dates";
import { REPORT_STEPS, FIGURE_LABEL, type FigureKey } from "@/lib/reports/fields";
import { useApprovalsQueue, useApprovalSettings, useUpdateApprovalSettings } from "@/hooks/api/approvals";
import { useDashboardApprovals } from "@/hooks/api/dashboard";
import { useApproveReport, useRejectReport } from "@/hooks/api/reports";
import { useRole } from "@/hooks/useRole";
import { notify } from "@/lib/toast";
import type { ApprovalWaitItem, ReportCell, SundayReport } from "@/lib/api/types";
import { ErrorCard, SectionCard, formatHours } from "@/components/coordinator/kit";

/** `report.cell` is a nested object on some endpoints, a bare UUID on others. */
function cellOf(report: SundayReport): ReportCell | null {
  return typeof report.cell === "object" && report.cell ? report.cell : null;
}

/** Best available cell display name: the nested cell object, then the dashboard's own label. */
function cellName(report: SundayReport, wait?: ApprovalWaitItem): string {
  return cellOf(report)?.name ?? (wait?.cell as string | undefined) ?? "Cell report";
}

function formatWait(seconds?: number): string {
  if (!seconds || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}d ${h % 24}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return h >= 1 ? `${h}h ${m}m` : `${m}m`;
}

export default function ApprovalsPage() {
  const { capabilities } = useRole();
  const queue = useApprovalsQueue();
  const waits = useDashboardApprovals();

  const reports = useMemo(
    () =>
      [...(queue.data ?? [])].sort((a, b) =>
        (a.date_created ?? "").localeCompare(b.date_created ?? ""),
      ),
    [queue.data],
  );

  const waitById = useMemo(() => {
    const map = new Map<string, ApprovalWaitItem>();
    for (const w of waits.data ?? []) if (w.id) map.set(String(w.id), w);
    return map;
  }, [waits.data]);

  // `selectedId` only tracks explicit clicks; the effective selection falls
  // back to the first row so it stays valid as the queue refetches.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  // Best-effort: some roles may not have access to this endpoint; failing
  // silently just drops the escalation-hours line, no error UI.
  const approvalSettings = useApprovalSettings();
  const escalationHours =
    !approvalSettings.isError && approvalSettings.data?.approval_interval != null
      ? formatHours(approvalSettings.data.approval_interval)
      : null;

  const subtitle = queue.isLoading
    ? "Cell reports awaiting your decision"
    : `${reports.length} report${reports.length === 1 ? "" : "s"} waiting on you.` +
      (escalationHours
        ? ` Anything not acted on in ${escalationHours} escalates to the next approver.`
        : "");

  return (
    <>
      <PageHeader
        eyebrow="Coordinator"
        title="Approvals"
        sub={subtitle}
        right={
          capabilities.canApprove && reports.length > 0 ? (
            <BulkApproveButton reports={reports} />
          ) : undefined
        }
      />

      <div className="dcc-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1200 }}>
        {!capabilities.canApprove && (
          <Card style={{ padding: 16, background: colors.panel }}>
            <div style={{ fontSize: 12.5, color: colors.muted }}>
              Your role has view-only access here — approvals are handled by Section Leaders, with
              Area and Zonal Coordinators as fallback.
            </div>
          </Card>
        )}

        {queue.isError ? (
          <ErrorCard message={`Could not load the approvals queue: ${queue.error.message}`} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(280px, 360px) 1fr",
              gap: 18,
              alignItems: "start",
            }}
            className="dcc-wizard"
          >
            <SectionCard title="Queue" sub={queue.isLoading ? "Loading…" : `${reports.length} pending`}>
              {queue.isLoading ? (
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : reports.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: colors.green }}>
                  Nothing waiting. The queue is clear.
                </div>
              ) : (
                <div>
                  {reports.map((r) => {
                    const w = waitById.get(r.id);
                    const on = r.id === selected?.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          borderBottom: `1px solid ${colors.hairline2}`,
                          background: on ? colors.redSoft : "transparent",
                          padding: "13px 18px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: on ? colors.red : colors.ink }}>
                            {cellName(r, w)}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: mono, color: w?.overdue ? colors.red : colors.faint }}>
                            {formatWait(w?.waiting_seconds)}
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 3 }}>
                          {[
                            cellOf(r)?.leader &&
                              [cellOf(r)!.leader!.first_name, cellOf(r)!.leader!.last_name].filter(Boolean).join(" "),
                            r.service_date ? formatServiceDate(new Date(r.service_date)) : null,
                            `${r.members_present ?? 0} present`,
                            w?.overdue ? "overdue" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <ReportDetail
              key={selected?.id ?? "none"}
              report={selected}
              wait={selected ? waitById.get(selected.id) : undefined}
              canApprove={capabilities.canApprove}
              loading={queue.isLoading}
            />
          </div>
        )}

        {capabilities.canApprove && reports.length > 0 && (
          <div style={{ fontSize: 11, color: colors.faint2, lineHeight: 1.5 }}>
            &ldquo;Approve all&rdquo; approves everything currently in the queue &mdash; there is no
            attendance-anomaly screening yet (that needs a per-cell report history the API does not
            expose), so review the list before using it.
          </div>
        )}

        {capabilities.canApprove && <ApprovalSettingsCard />}
      </div>
    </>
  );
}

/**
 * Approves every report currently in the queue, one request at a time.
 *
 * The mock distinguishes "clean" reports from ones flagged for an attendance
 * anomaly (needs a per-cell report history the API doesn't expose — see
 * `/coordinator` page notes). Without that signal this approves everything
 * listed, unscreened — so it's deliberately not labelled "clean".
 */
function BulkApproveButton({ reports }: { reports: SundayReport[] }) {
  const approve = useApproveReport();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    let ok = 0;
    let failed = 0;
    for (const r of reports) {
      try {
        await approve.mutateAsync({ id: r.id });
        ok++;
      } catch {
        failed++;
      }
    }
    setRunning(false);
    if (failed === 0) {
      notify.success(`Approved ${ok} report${ok === 1 ? "" : "s"}`);
    } else {
      notify.error(`${failed} of ${ok + failed} approvals failed`, "Some reports could not be approved");
    }
  }

  return (
    <Button variant="secondary" onClick={run} disabled={running} padding="7px 12px" fontSize={12}>
      {running ? "Approving…" : `Approve all (${reports.length})`}
    </Button>
  );
}

function ReportDetail({
  report,
  wait,
  canApprove,
  loading,
}: {
  report: SundayReport | null;
  wait?: ApprovalWaitItem;
  canApprove: boolean;
  loading: boolean;
}) {
  const approve = useApproveReport();
  const reject = useRejectReport();
  // Component is remounted per report via `key`, so this state is fresh each time.
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [comment, setComment] = useState("");
  const busy = approve.isPending || reject.isPending;

  if (loading) {
    return (
      <Card style={{ padding: 22 }}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-64" />
        <Skeleton className="mt-6 h-40 w-full" />
      </Card>
    );
  }

  if (!report) {
    return (
      <Card style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: colors.faint }}>Select a report from the queue.</div>
      </Card>
    );
  }

  async function onApprove() {
    try {
      await approve.mutateAsync({ id: report!.id, comment: comment.trim() || undefined });
      notify.success("Report approved");
    } catch (err) {
      notify.error(err, "Could not approve the report");
    }
  }

  async function onReject() {
    if (!comment.trim()) {
      notify.error("Add a note so the Cell Leader knows what to fix");
      return;
    }
    try {
      await reject.mutateAsync({ id: report!.id, comment: comment.trim() });
      notify.success("Report sent back");
      setMode("idle");
      setComment("");
    } catch (err) {
      notify.error(err, "Could not send the report back");
    }
  }

  const cell = cellOf(report);
  const leaderName = cell?.leader
    ? [cell.leader.first_name, cell.leader.last_name].filter(Boolean).join(" ")
    : null;

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: "18px 22px", borderBottom: `1px solid ${colors.hairline}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {cellName(report, wait)}
          </div>
          <div style={{ fontSize: 12, color: wait?.overdue ? colors.red : colors.faint, fontFamily: mono, fontWeight: 600 }}>
            waiting {formatWait(wait?.waiting_seconds)}
            {wait?.overdue ? " · overdue" : ""}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: colors.muted, marginTop: 4 }}>
          {[
            leaderName && `Cell Leader ${leaderName}`,
            cell?.code,
            report.service_date ? formatServiceDate(new Date(report.service_date)) : null,
            report.meeting_held === false ? "meeting not held" : "meeting held",
            report.date_created ? `submitted ${formatServiceDate(new Date(report.date_created))}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        {report.comment && (
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: colors.faint,
                marginBottom: 8,
              }}
            >
              Cell Leader comments
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: colors.muted,
                background: colors.panel,
                borderRadius: 10,
                padding: "10px 12px",
                lineHeight: 1.5,
              }}
            >
              “{report.comment}”
            </div>
          </div>
        )}

        {REPORT_STEPS.filter((s) => s.fields.length > 0).map((step) => {
          const entries = step.fields
            .map((f) => ({ label: FIGURE_LABEL[f.key as FigureKey] ?? f.label, value: report[f.key as FigureKey] }))
            .filter((e) => typeof e.value === "number");
          if (entries.length === 0) return null;
          return (
            <div key={step.category}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: colors.faint,
                  marginBottom: 8,
                }}
              >
                {step.category}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 }}>
                {entries.map((e) => (
                  <div
                    key={e.label}
                    style={{
                      border: `1px solid ${colors.hairline}`,
                      borderRadius: 8,
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600, fontFamily: mono }}>{String(e.value)}</div>
                    <div style={{ fontSize: 10.5, color: colors.faint, marginTop: 2 }}>{e.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {typeof report.total_offering === "number" && (
          <div style={{ fontSize: 12.5, color: colors.muted }}>
            Offering: <strong style={{ fontFamily: mono }}>{report.total_offering.toLocaleString()}</strong>{" "}
            {report.currency ?? ""}
          </div>
        )}

        {canApprove && (
          <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 16 }}>
            {mode === "reject" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <TextArea
                  value={comment}
                  onChange={setComment}
                  placeholder="What does the Cell Leader need to correct?"
                  minHeight={90}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="primary" onClick={onReject} disabled={busy}>
                    {reject.isPending ? "Sending…" : "Send back"}
                  </Button>
                  <Button variant="secondary" onClick={() => setMode("idle")} disabled={busy}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <Button variant="primary" onClick={onApprove} disabled={busy}>
                  {approve.isPending ? "Approving…" : "Approve"}
                </Button>
                <Button variant="danger-outline" onClick={() => setMode("reject")} disabled={busy}>
                  Send back
                </Button>
                {/* Not wired up — no messaging endpoint exists yet. Shown, not hidden, so the
                    intended feature set is visible; disabled rather than silently omitted. */}
                <span
                  aria-disabled="true"
                  title="Not available yet — there's no messaging endpoint."
                  style={{ fontSize: 13, color: colors.faint2, cursor: "not-allowed" }}
                >
                  Message leader
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ApprovalSettingsCard() {
  const settings = useApprovalSettings();
  const update = useUpdateApprovalSettings();

  // `edited` is null until the user types; the field shows the server value
  // until then. No effect needed to sync them.
  const [edited, setEdited] = useState<string | null>(null);
  const serverHours =
    settings.data?.approval_interval != null
      ? String(Math.round((settings.data.approval_interval / 3600) * 10) / 10)
      : "";
  const hours = edited ?? serverHours;

  async function save() {
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0) {
      notify.error("Enter a positive number of hours");
      return;
    }
    try {
      await update.mutateAsync({ approval_interval: Math.round(h * 3600) });
      notify.success("Fallback window updated");
    } catch (err) {
      notify.error(err, "Could not update the fallback window");
    }
  }

  return (
    <SectionCard
      title="Fallback approval window"
      sub="How long a report waits for the Section Leader before an Area / Zonal Coordinator can step in"
    >
      <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {settings.isLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          <>
            <input
              inputMode="decimal"
              value={hours}
              onChange={(e) => setEdited(e.target.value.replace(/[^0-9.]/g, ""))}
              aria-label="Fallback window in hours"
              style={{
                width: 90,
                minHeight: 40,
                textAlign: "right",
                border: `1.5px solid ${colors.borderStrong}`,
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: 15,
                fontFamily: mono,
                outline: "none",
                background: colors.fieldBg,
              }}
            />
            <span style={{ fontSize: 13, color: colors.muted }}>hours</span>
            <Button variant="dark" onClick={save} disabled={update.isPending} padding="9px 16px" fontSize={13}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
            {settings.isError && (
              <span style={{ fontSize: 12, color: colors.red }}>Could not load the current value.</span>
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}
