"use client";

import { useState } from "react";
import { PageHeader, Button } from "@/components/ui";
import { colors, mono } from "@/lib/tokens";
import { lastClosedSundays } from "@/lib/dates";
import { useDashboardExport, useNonSubmitters } from "@/hooks/api/dashboard";
import type { NonSubmitterRow } from "@/lib/api/types";
import { notify } from "@/lib/toast";
import {
  SectionCard,
  ServiceDatePicker,
  defaultServiceDate,
  nonSubmitterCode,
  nonSubmitterName,
} from "@/components/coordinator/kit";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function csvField(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Built entirely from data already fetched for the Cells page — the export
 * endpoint itself has no dataset picker (it's one compliance CSV per date
 * range), so this is generated client-side rather than downloaded.
 */
function chronicNonReportersCsv(rows: NonSubmitterRow[]): string {
  const header = ["Cell", "Code"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([nonSubmitterName(r), nonSubmitterCode(r)].map(csvField).join(","));
  }
  return lines.join("\n");
}

function downloadTextFile(content: string, filename: string, mimeType = "text/csv"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function presetRange(key: string): { start: string; end: string } {
  const now = new Date();
  const sundays = lastClosedSundays(4, now);
  switch (key) {
    case "last-sunday":
      return { start: iso(sundays[0]), end: iso(sundays[0]) };
    case "last-4":
      return { start: iso(sundays[3]), end: iso(sundays[0]) };
    case "quarter": {
      const q = Math.floor(now.getUTCMonth() / 3) * 3;
      return { start: iso(new Date(Date.UTC(now.getUTCFullYear(), q, 1))), end: iso(now) };
    }
    case "ytd":
      return { start: iso(new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), end: iso(now) };
    default:
      return { start: iso(sundays[0]), end: iso(sundays[0]) };
  }
}

const PRESETS = [
  { key: "last-sunday", label: "Last Sunday" },
  { key: "last-4", label: "Last 4 Sundays" },
  { key: "quarter", label: "Quarter to date" },
  { key: "ytd", label: "Year to date" },
];

export default function ExportsPage() {
  const initial = presetRange("last-4");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [running, setRunning] = useState(false);
  const { download } = useDashboardExport();

  function applyPreset(key: string) {
    const r = presetRange(key);
    setStart(r.start);
    setEnd(r.end);
  }

  async function run() {
    if (!start || !end) {
      notify.error("Pick a start and end date");
      return;
    }
    if (start > end) {
      notify.error("The start date is after the end date");
      return;
    }
    setRunning(true);
    try {
      const { blob, filename } = await download(start, end);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `dcc-compliance-${start}_${end}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify.success("Export downloaded");
    } catch (err) {
      notify.error(err, "Could not generate the export");
    } finally {
      setRunning(false);
    }
  }

  const field: React.CSSProperties = {
    minHeight: 40,
    border: `1.5px solid ${colors.borderStrong}`,
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: mono,
    outline: "none",
    background: colors.fieldBg,
  };

  return (
    <>
      <PageHeader
        eyebrow="Coordinator"
        title="Exports"
        sub="Pull the same figures the dashboard shows into a CSV for board and pastoral reporting."
      />

      <div className="dcc-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
        <SectionCard
          title="Compliance summary"
          sub="Submitted, pending and missing counts. Scope: your assigned level — there's no way to
            pick a level below it, since nothing lists the units under you yet."
        >
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  style={{
                    border: `1px solid ${colors.borderStrong}`,
                    background: "#fff",
                    color: colors.muted,
                    borderRadius: 8,
                    padding: "6px 11px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: colors.muted }}>Start date</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={field} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: colors.muted }}>End date</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={field} />
              </label>
            </div>

            <div>
              <Button variant="primary" onClick={run} disabled={running}>
                {running ? "Preparing…" : "Generate CSV"}
              </Button>
            </div>
          </div>
        </SectionCard>

        <ChronicExportCard />

        <NotAvailableCard />
      </div>
    </>
  );
}

/**
 * A second, narrower export: chronic non-reporters for one Sunday. Unlike the
 * compliance export above, this doesn't call `orgDashboardExport` — it reuses
 * the same non-submitters data the Cells page shows and builds the CSV in the
 * browser, since the API has no per-dataset export parameter.
 */
function ChronicExportCard() {
  const [serviceDate, setServiceDate] = useState(defaultServiceDate);
  const nonSubmitters = useNonSubmitters({ serviceDate, chronic: true });
  const rows = nonSubmitters.data ?? [];

  function run() {
    if (rows.length === 0) {
      notify.error("No chronic non-reporters for this Sunday");
      return;
    }
    downloadTextFile(chronicNonReportersCsv(rows), `dcc-chronic-non-reporters-${serviceDate}.csv`);
    notify.success("Export downloaded");
  }

  return (
    <SectionCard
      title="Chronic non-reporters"
      sub="Cells that have missed 3+ consecutive Sundays, as of the selected Sunday"
      right={<ServiceDatePicker value={serviceDate} onChange={setServiceDate} />}
    >
      <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: colors.muted }}>
          {nonSubmitters.isLoading
            ? "Loading…"
            : nonSubmitters.isError
              ? `Could not load: ${nonSubmitters.error.message}`
              : `${rows.length} cell${rows.length === 1 ? "" : "s"} in this list`}
        </div>
        <Button
          variant="secondary"
          onClick={run}
          disabled={nonSubmitters.isLoading || nonSubmitters.isError}
          padding="8px 14px"
          fontSize={12.5}
        >
          Download CSV
        </Button>
      </div>
    </SectionCard>
  );
}

const BLOCKED_DATASETS = [
  {
    label: "Report figures",
    detail: "All 24 fields per cell, per Sunday",
    reason: "needs a bulk per-cell report export — the current endpoint returns a summary, not raw figures",
  },
  {
    label: "Follow-up outcomes",
    detail: "Assignments, contact status and days open",
    reason: "no first-timer / follow-up data exists in the API yet",
  },
  {
    label: "Leader directory",
    detail: "Names, roles, phone numbers and activation status",
    reason: "no endpoint lists the leaders in your scope",
  },
];

/**
 * Shown, not hidden: lists the rest of the export feature set from the design
 * so it's visible what's coming, each with why it isn't wired up yet, rather
 * than silently dropping it from the page.
 */
function NotAvailableCard() {
  return (
    <SectionCard title="Not available yet" sub="PDF format and scheduled, emailed exports are blocked for the same reasons.">
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        {BLOCKED_DATASETS.map((d) => (
          <label
            key={d.label}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "10px 12px",
              border: `1px solid ${colors.hairline}`,
              borderRadius: 10,
              cursor: "not-allowed",
            }}
          >
            <input type="checkbox" disabled style={{ marginTop: 3 }} aria-label={`${d.label} — not available yet`} />
            <span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: colors.faint }}>
                {d.label}
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: colors.faint2, marginTop: 1 }}>{d.detail}</span>
              <span style={{ display: "block", fontSize: 11, color: colors.faint2, marginTop: 3, fontStyle: "italic" }}>
                Blocked: {d.reason}.
              </span>
            </span>
          </label>
        ))}
      </div>
    </SectionCard>
  );
}
