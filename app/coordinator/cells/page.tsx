"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/lib/tokens";
import { useNonSubmitters, useOrgDashboard } from "@/hooks/api/dashboard";
import type { NonSubmitterRow } from "@/lib/api/types";
import {
  ErrorCard,
  SectionCard,
  ServiceDatePicker,
  StatTile,
  defaultServiceDate,
  nonSubmitterCode,
  nonSubmitterIsChronic,
  nonSubmitterKey,
  nonSubmitterName,
} from "@/components/coordinator/kit";

/**
 * Cells register — scoped to what the API exposes at cell granularity today:
 * the non-reporting / chronic cells for a given Sunday. A full directory of
 * every cell (leader, type, 8-week rate, "Add cell") needs a "list units in my
 * scope" endpoint the API does not offer yet — see the note at the bottom.
 */
export default function CellsPage() {
  const [serviceDate, setServiceDate] = useState(defaultServiceDate);
  const [chronicOnly, setChronicOnly] = useState(false);
  const [query, setQuery] = useState("");

  const dash = useOrgDashboard(serviceDate);
  const nonSubmitters = useNonSubmitters({ serviceDate, chronic: chronicOnly });
  // A separate always-chronic query for the stat tile: `chronic` isn't a
  // documented per-row field on non-submitters/, so when the table itself
  // isn't chronic-filtered there's no reliable way to count chronic rows out
  // of the full list.
  const chronicCount = useNonSubmitters({ serviceDate, chronic: true });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (nonSubmitters.data ?? []).filter((r) => {
      if (!q) return true;
      return `${nonSubmitterName(r)} ${nonSubmitterCode(r)}`.toLowerCase().includes(q);
    });
  }, [nonSubmitters.data, query]);

  const total = dash.data?.total_cells ?? 0;
  const submitted = dash.data?.submitted_cells ?? 0;
  const notSubmitted = dash.data?.missing_cells?.length ?? Math.max(0, total - submitted);

  return (
    <>
      <PageHeader
        eyebrow="Coordinator"
        title="Cells"
        sub="Non-reporting and chronic cells in your scope"
        right={<ServiceDatePicker value={serviceDate} onChange={setServiceDate} />}
      />

      <div className="dcc-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
        {dash.isError ? (
          <ErrorCard message={`Could not load cell counts: ${dash.error.message}`} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
            <StatTile label="Cells in scope" value={total} loading={dash.isLoading} />
            <StatTile label="Reported" value={submitted} color={colors.green} loading={dash.isLoading} />
            <StatTile label="Not submitted" value={notSubmitted} color={colors.red} loading={dash.isLoading} />
            <StatTile
              label="Chronic"
              value={chronicCount.data?.length ?? 0}
              color={colors.red}
              loading={chronicCount.isLoading}
            />
          </div>
        )}

        {nonSubmitters.isError ? (
          <ErrorCard message={`Could not load cells: ${nonSubmitters.error.message}`} />
        ) : (
          <SectionCard
            title={chronicOnly ? "Chronic non-reporters" : "Did not report"}
            sub={
              nonSubmitters.isLoading
                ? "Loading…"
                : `${rows.length} cell${rows.length === 1 ? "" : "s"}`
            }
            right={
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cell or code"
                  style={{
                    minHeight: 34,
                    width: 200,
                    border: `1px solid ${colors.borderStrong}`,
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12.5,
                    outline: "none",
                    background: "#fff",
                  }}
                />
                {[
                  { k: false, label: "All" },
                  { k: true, label: "Chronic" },
                ].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => setChronicOnly(f.k)}
                    style={{
                      border: `1px solid ${f.k === chronicOnly ? colors.ink : colors.borderStrong}`,
                      background: f.k === chronicOnly ? colors.ink : "#fff",
                      color: f.k === chronicOnly ? "#fff" : colors.muted,
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            }
          >
            {nonSubmitters.isLoading ? (
              <CellsSkeleton />
            ) : rows.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center", fontSize: 13, color: colors.green }}>
                {query
                  ? "No cells match that search."
                  : chronicOnly
                    ? "No chronic non-reporters in scope."
                    : "Every cell in scope reported for this Sunday."}
              </div>
            ) : (
              <CellsTable rows={rows} chronicView={chronicOnly} />
            )}
          </SectionCard>
        )}

        <div style={{ fontSize: 11, color: colors.faint2, lineHeight: 1.5 }}>
          A full directory of every cell &mdash; leader, type, code, an 8-week rate per cell &mdash;
          needs an endpoint that lists the units in your scope, which the API does not expose yet.
          Cell creation is not here either: the PRD routes that through the Super Admin&rsquo;s CSV
          upload, not a per-scope &ldquo;Add cell&rdquo; action.
        </div>
      </div>
    </>
  );
}

const COLUMNS = ["Cell", "Code", "Status"] as const;

function CellsTable({ rows, chronicView }: { rows: NonSubmitterRow[]; chronicView: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((c) => (
            <TableHead key={c}>{c}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => {
          const chronic = nonSubmitterIsChronic(r, chronicView);
          return (
            <TableRow key={nonSubmitterKey(r, i)}>
              <TableCell className="font-medium">{nonSubmitterName(r)}</TableCell>
              <TableCell className="text-muted-foreground tabular-nums">{nonSubmitterCode(r)}</TableCell>
              <TableCell>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: chronic ? colors.redSoft : colors.amberSoft,
                    color: chronic ? colors.red : colors.amber,
                  }}
                >
                  {chronic ? "Chronic" : "Not submitted"}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CellsSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((c) => (
            <TableHead key={c}>{c}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="h-4 w-14" /></TableCell>
            <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
