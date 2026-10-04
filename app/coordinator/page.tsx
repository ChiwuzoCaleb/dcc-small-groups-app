"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Card, PageHeader } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServiceDatePicker, defaultServiceDate, displayNameFrom } from "@/components/coordinator/kit";
import {
  useChronicCells,
  useComplianceTrends,
  useOrgDashboard,
  useUnitDashboard,
} from "@/hooks/api/dashboard";
import { ReportDetailDialog } from "@/components/leader/ReportDetailDialog";
import { useReport, useReportsForDate, useExportReports } from "@/hooks/api/reports";
import { notify } from "@/lib/toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { colors, mono } from "@/lib/tokens";
import type { RoleName } from "@/lib/auth/roles";
import type { OrgUnitType } from "@/lib/api/types";
import type { SundayReport } from "@/lib/api/types";

type FilterKey = "ALL" | "SUBMITTED" | "NOT_SUBMITTED" | "PENDING_APPROVAL" | "CHRONIC";

type DashboardOrgNode = Record<string, unknown>;

type DashboardRow = {
  id: string;
  name: string;
  code?: string | null;
  leader?: string | null;
  approved: number | null;
  pending_approval: number | null;
  approvalStatus?: string | null;
  missing_cells_count: number | null;
  compliance_percentage: number | null;
  chronic_cells_count: number | null;
  leaderPhone: string | null;
  leaderEmail: string | null;
  cellCount: number | null;
  isChronic: boolean;
  isCell: boolean;
  isMissing: boolean;
  hasChildren: boolean;
  node?: DashboardOrgNode;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "NOT_SUBMITTED", label: "Missing" },
  { key: "PENDING_APPROVAL", label: "Pending approval" },
  { key: "CHRONIC", label: "Chronic" },
];

type UnitLevel = OrgUnitType;

const ROLE_SCOPES: Partial<Record<RoleName, UnitLevel>> = {
  SECTION_LEADER: "section",
  AREA_LEADER: "area",
  ZONE_LEADER: "zone",
  DISTRICT_LEADER: "district",
  REGION_LEADER: "region",
};

const UNIT_LABELS: Record<UnitLevel, { singular: string; plural: string; collection: string | null }> = {
  region: { singular: "Region", plural: "Regions", collection: "regions" },
  district: { singular: "District", plural: "Districts", collection: "districts" },
  zone: { singular: "Zone", plural: "Zones", collection: "zones" },
  area: { singular: "Area", plural: "Areas", collection: "areas" },
  section: { singular: "Section", plural: "Sections", collection: "sections" },
  cell: { singular: "Cell", plural: "Cells", collection: null },
};

const NEXT_LEVEL: Partial<Record<UnitLevel, UnitLevel>> = {
  region: "district",
  district: "zone",
  zone: "area",
  area: "section",
  section: "cell",
};

function asRecord(value: unknown): DashboardOrgNode | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as DashboardOrgNode
    : null;
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function findAssignedUnit(data: unknown, level: UnitLevel, id: string): DashboardOrgNode | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const match = findAssignedUnit(item, level, id);
      if (match) return match;
    }
    return null;
  }

  const record = asRecord(data);
  if (!record) return null;
  const unit = asRecord(record[level]);
  if (unit && String(unit.id ?? "") === id) return unit;

  // The org dashboard lists units under plural keys (e.g. `regions: [{ id, … }]`).
  const listed = record[`${level}s`];
  if (Array.isArray(listed)) {
    for (const item of listed) {
      const candidate = asRecord(item);
      if (candidate && String(candidate.id ?? "") === id) return candidate;
    }
  }

  for (const value of Object.values(record)) {
    const match = findAssignedUnit(value, level, id);
    if (match) return match;
  }
  return null;
}

function childUnits(node: DashboardOrgNode, level: UnitLevel): DashboardOrgNode[] {
  if (level === "cell") {
    const cells = Array.isArray(node.all_cells) ? node.all_cells : Array.isArray(node.cells) ? node.cells : node.missing_cells;
    if (!Array.isArray(cells)) return [];
    return cells.map((cell) => {
      const record = asRecord(cell);
      return record && asRecord(record.cell) ? asRecord(record.cell)! : record;
    }).filter((cell): cell is DashboardOrgNode => cell !== null);
  }

  const collection = UNIT_LABELS[level].collection;
  const values = collection ? node[collection] : null;
  if (!Array.isArray(values)) return [];
  return values.map((value) => {
    const record = asRecord(value);
    return record && asRecord(record[level]) ? asRecord(record[level])! : record;
  }).filter((unit): unit is DashboardOrgNode => unit !== null);
}

function countCells(node: DashboardOrgNode, level: UnitLevel): number | null {
  const next = NEXT_LEVEL[level];
  if (!next) return null;
  const children = childUnits(node, next);
  if (next === "cell") return Array.isArray(node.all_cells) || Array.isArray(node.cells) ? children.length : null;
  if (children.length === 0) return null;
  let total = 0;
  for (const child of children) {
    const count = optionalNumber(child.total_cells) ?? countCells(child, next);
    if (count === null) return null;
    total += count;
  }
  return total;
}

function countByApproval(node: DashboardOrgNode, level: UnitLevel, status: string): number | null {
  const next = NEXT_LEVEL[level];
  if (!next) return null;
  const children = childUnits(node, next);
  if (next === "cell") {
    if (!Array.isArray(node.all_cells) && !Array.isArray(node.cells)) return null;
    return children.filter((cell) => cell.has_submitted !== false && cell.approval_status === status).length;
  }
  let total = 0;
  for (const child of children) total += countByApproval(child, next, status) ?? 0;
  return total;
}

function rowFromUnit(
  unit: DashboardOrgNode,
  level: UnitLevel,
  chronicCellIds: ReadonlySet<string>,
  fromMissingList: boolean,
  index = 0,
): DashboardRow {
  const id = String(unit.id ?? unit.uuid ?? unit.code ?? "");
  const unitCode = level === "district" || level === "zone" || level === "area" || level === "section"
    ? unit[`${level}_code`] ?? unit.code
    : unit.code;
  const code = optionalText(unitCode);
  const isCell = level === "cell";
  const hasSubmitted = typeof unit.has_submitted === "boolean" ? unit.has_submitted : null;
  const approvalStatus = optionalText(unit.approval_status);
  const isMissing = hasSubmitted !== null
    ? !hasSubmitted
    : fromMissingList || unit.is_missing === true || unit.status === "NOT_SUBMITTED";
  const leaderName = typeof unit.leader_name === "string" ? unit.leader_name.trim() : "";
  const leader = leaderName
    ? leaderName
    : typeof unit.leader === "string"
      ? unit.leader
      : typeof asRecord(unit.leader)?.name === "string"
        ? String(asRecord(unit.leader)?.name)
        : null;
  const leaderObject = asRecord(unit.leader);
  const name = typeof unit.name === "string"
    ? unit.name
    : typeof unit.label === "string"
      ? unit.label
      : typeof unit[`${level}_name`] === "string"
        ? String(unit[`${level}_name`])
      : code ?? `${UNIT_LABELS[level].singular} ${index + 1}`;
  const nextLevel = NEXT_LEVEL[level];
  const descendants = nextLevel ? childUnits(unit, nextLevel) : [];

  return {
    id,
    name,
    code,
    leader,
    approved: optionalNumber(unit.approved ?? unit.approved_count) ?? (isCell ? null : countByApproval(unit, level, "APPROVED")),
    pending_approval: optionalNumber(unit.pending_approval ?? unit.pending) ?? (!isCell ? countByApproval(unit, level, "PENDING") : null) ?? (isCell && approvalStatus ? (approvalStatus === "PENDING" ? 1 : 0) : null),
    approvalStatus,
    missing_cells_count: optionalNumber(unit.missing_cells_count) ?? (isCell && isMissing ? 1 : null),
    compliance_percentage: optionalNumber(unit.compliance_percentage),
    chronic_cells_count: optionalNumber(unit.chronic_cells_count ?? unit.chronic_count),
    leaderPhone: optionalText(unit.leader_phone ?? unit.phone_number ?? leaderObject?.phone_number),
    leaderEmail: optionalText(unit.leader_email ?? unit.email ?? leaderObject?.email),
    cellCount: optionalNumber(unit.total_cells) ?? (isCell ? null : countCells(unit, level)),
    isChronic: isCell && chronicCellIds.has(id),
    isCell,
    isMissing,
    hasChildren: descendants.length > 0,
    node: unit,
  };
}

function rowsForUnit(
  node: DashboardOrgNode,
  level: UnitLevel,
  chronicCells: unknown[],
): DashboardRow[] {
  const chronicCellIds = new Set<string>();
  for (const value of chronicCells) {
    const cell = asRecord(value);
    const id = cell ? String(cell.id ?? cell.uuid ?? "") : "";
    if (id) chronicCellIds.add(id);
  }

  const nextLevel = NEXT_LEVEL[level];
  if (!nextLevel) return [];
  const hasFullCellList = nextLevel === "cell" && (Array.isArray(node.all_cells) || Array.isArray(node.cells));
  return childUnits(node, nextLevel).map((unit, index) =>
    rowFromUnit(unit, nextLevel, chronicCellIds, nextLevel === "cell" && !hasFullCellList, index));
}
export default function CoordinatorPage() {
  const { user } = useAuth();
  const { role, capabilities } = useRole();
  const [serviceDate, setServiceDate] = useState(defaultServiceDate);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [drillPath, setDrillPath] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedCell, setSelectedCell] = useState<DashboardRow | null>(null);
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  }, []);

  const scopeLevel = ROLE_SCOPES[role] ?? "region";
  const userRecord = user as DashboardOrgNode | null;
  const assignedUnit = asRecord(userRecord?.[scopeLevel]);
  const assignedId = typeof assignedUnit?.id === "string" ? assignedUnit.id : "";
  const dashboard = useOrgDashboard(serviceDate);
  const scopedDashboard = useUnitDashboard(scopeLevel, assignedId || null, serviceDate);
  const chronicCells = useChronicCells(serviceDate);
  const trend = useComplianceTrends(8);
  const scopedReports = useReportsForDate(serviceDate, selectedCell !== null && !selectedCell.isMissing);
  const selectedReport = useMemo(() => {
    if (!selectedCell || selectedCell.isMissing || !scopedReports.data) return null;
    return scopedReports.data.find((report) => {
      const reportCellId = typeof report.cell === "object" && report.cell ? report.cell.id : report.cell;
      return reportCellId === selectedCell.id;
    }) ?? null;
  }, [scopedReports.data, selectedCell]);
  const reportDetail = useReport(selectedReport?.id ?? null);
  const userRegionId = asRecord(userRecord?.region)?.id;
  // Region/district leaders are scoped server-side; only a super admin must send a region.
  const regionId = typeof userRegionId === "string" && userRegionId
    ? userRegionId
    : scopeLevel === "region" ? assignedId : "";
  const [confirmExport, setConfirmExport] = useState(false);
  const exportReports = useExportReports();
  function handleExport() {
    exportReports.mutate(
      { date: serviceDate, regionId },
      {
        onSuccess: () => {
          setConfirmExport(false);
          notify.success("Report export downloaded.");
        },
        onError: (err) => {
          setConfirmExport(false);
          notify.error(err.message || "Could not export reports.");
        },
      },
    );
  }
  const scopeNode = useMemo(
    () => assignedId ? findAssignedUnit(dashboard.data, scopeLevel, assignedId) : null,
    [assignedId, dashboard.data, scopeLevel],
  );

  let currentNode = scopeNode;
  let currentLevel = scopeLevel;
  const activePath: string[] = [];
  for (const id of drillPath) {
    const nextLevel = NEXT_LEVEL[currentLevel];
    if (!currentNode || !nextLevel) break;
    const nextNode = childUnits(currentNode, nextLevel).find((item) => String(item.id ?? item.uuid ?? item.code ?? "") === id);
    if (!nextNode) break;
    currentNode = nextNode;
    currentLevel = nextLevel;
    activePath.push(id);
  }

  const rows = useMemo(
    () => currentNode ? rowsForUnit(currentNode, currentLevel, chronicCells.data ?? []) : [],
    [chronicCells.data, currentLevel, currentNode],
  );
  const baseRows = rows;
  const filteredRows = useMemo(() => baseRows.filter((row) => {
    if (filter === "ALL") return true;
    if (filter === "SUBMITTED") return row.isCell ? !row.isMissing : (row.cellCount ?? 0) > (row.missing_cells_count ?? 0);
    if (filter === "NOT_SUBMITTED") return row.isMissing || (row.missing_cells_count ?? 0) > 0;
    if (filter === "PENDING_APPROVAL") return (row.pending_approval ?? 0) > 0;
    if (filter === "CHRONIC") return row.isChronic || (row.chronic_cells_count ?? 0) > 0;
    return true;
  }), [baseRows, filter]);

  const scopeSummary = scopedDashboard.data;
  const compliance = optionalNumber(scopeSummary?.compliance_percentage ?? scopeNode?.compliance_percentage);
  const missing = scopeSummary
    ? Math.max(0, scopeSummary.total_cells - scopeSummary.submitted_cells)
    : optionalNumber(scopeNode?.missing_cells_count);
  const pending = optionalNumber(scopeSummary?.pending_approval) ?? (scopeNode ? countByApproval(scopeNode, currentLevel, "PENDING") : null);
  const chronic = chronicCells.data?.length ?? null;
  const tableLevel = NEXT_LEVEL[currentLevel] ?? "cell";
  const tableLabels = UNIT_LABELS[tableLevel];
  const scopeTitle = asRecord(scopeSummary?.scope)?.name;
  const unitTitle = typeof scopeTitle === "string" ? scopeTitle : typeof assignedUnit?.name === "string" ? assignedUnit.name : capabilities.label;
  const leaderName = displayNameFrom(userRecord);
  const title = `${greeting}${leaderName ? `, ${leaderName}` : ""}`;
  const currentTitle = typeof currentNode?.name === "string"
    ? currentNode.name
    : currentLevel === "district" || currentLevel === "zone" || currentLevel === "area" || currentLevel === "section"
      ? unitTitle
      : unitTitle;
  const totalCells = optionalNumber(scopeSummary?.total_cells ?? scopeNode?.total_cells);
  const displayCount = (value: number | null | undefined) => value === null || value === undefined ? "-" : String(value);
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / 10));
  const isCellTable = currentLevel === "section" && tableLevel === "cell";
  const visibleRows = isCellTable ? filteredRows.slice((page - 1) * 10, page * 10) : filteredRows;

  function drillInto(row: DashboardRow) {
    if (row.hasChildren && row.id) {
      setDrillPath([...activePath, row.id]);
      setFilter("ALL");
      setPage(1);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={capabilities.label}
        title={title}
        sub={`${unitTitle} · ${displayCount(totalCells)} cells in scope`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ServiceDatePicker value={serviceDate} onChange={(date) => { setServiceDate(date); setDrillPath([]); setPage(1); }} />
            {(role === "ZONE_LEADER" || role === "DISTRICT_LEADER" || role === "REGION_LEADER") && (
              <>
              <Button
                variant="secondary"
                padding="8px 12px"
                fontSize={12.5}
                onClick={() => setConfirmExport(true)}
                disabled={exportReports.isPending}
              >
                {exportReports.isPending ? "Exporting…" : "Export Report"}
              </Button>
              <Dialog open={confirmExport} onOpenChange={(open) => { if (!exportReports.isPending) setConfirmExport(open); }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Export Sunday report?</DialogTitle>
                    <DialogDescription>
                      This will generate an Excel file of all cell reports for {new Date(`${serviceDate}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="secondary" padding="9px 14px" fontSize={13} disabled={exportReports.isPending} onClick={() => setConfirmExport(false)}>
                      Cancel
                    </Button>
                    <Button variant="dark" padding="9px 14px" fontSize={13} disabled={exportReports.isPending} onClick={handleExport}>
                      {exportReports.isPending ? "Exporting…" : "Yes, export"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </>
            )}
          </div>
        }
      />

      <div className="dcc-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <ComplianceMetricCard value={compliance} hasPending={(pending ?? 0) > 0} trend={trend.data ?? []} loading={trend.isLoading} />
          <MetricCard label="Not submitted" value={displayCount(missing)} detail="Cells missing a report for this Sunday." tone="red" />
          <MetricCard label="Pending approval" value={displayCount(pending)} detail="Reports waiting in your scope." tone="amber" />
          <MetricCard label="Chronic non-reporters" value={displayCount(chronic)} detail="Cells with 3 or more consecutive misses." tone="red" />
        </div>

        <Card style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "18px 20px", borderBottom: `1px solid ${colors.border}`, background: "#f9f9f7" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: colors.ink }}>
                {activePath.length > 0 && (
                  <button
                    type="button"
                    aria-label={`Back to ${UNIT_LABELS[currentLevel].plural.toLowerCase()}`}
                    title={`Back to ${UNIT_LABELS[currentLevel].plural.toLowerCase()}`}
                    onClick={() => setDrillPath(activePath.slice(0, -1))}
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      padding: 0,
                      border: `1px solid ${colors.borderStrong}`,
                      borderRadius: 8,
                      background: "#fff",
                      color: colors.ink,
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft aria-hidden="true" size={16} />
                  </button>
                )}
                {tableLabels.plural} under {currentTitle}
              </div>
              <div style={{ fontSize: 12, color: colors.faint, marginTop: 3 }}>
                {filteredRows.length} {tableLabels.plural.toLowerCase()} in this view
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {FILTERS.map((item) => (
                <button key={item.key} type="button" onClick={() => { setFilter(item.key); setPage(1); }} style={{ border: `1px solid ${filter === item.key ? colors.ink : colors.borderStrong}`, background: filter === item.key ? colors.ink : "#fff", color: filter === item.key ? "#fff" : colors.muted, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: currentLevel === "section" ? "25%" : "22%" }}>{tableLabels.singular}</TableHead>
                {currentLevel === "section" && tableLevel === "cell" ? (
                  <>
                    <TableHead style={{ width: "18%" }}>Leader</TableHead>
                    <TableHead style={{ width: "16%" }}>Leader phone</TableHead>
                    <TableHead style={{ width: "26%" }}>Leader email</TableHead>
                    <TableHead style={{ width: "15%" }}>Status</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead style={{ width: "14%" }}>Leader</TableHead>
                    <TableHead style={{ width: "12%" }}>Leader phone</TableHead>
                    <TableHead style={{ width: "18%" }}>Leader email</TableHead>
                    <TableHead style={{ width: "7%" }}>Appr.</TableHead>
                    <TableHead style={{ width: "7%" }}>Pend.</TableHead>
                    <TableHead style={{ width: "8%" }}>Missing</TableHead>
                    <TableHead style={{ width: "12%" }}>{tableLevel === "cell" ? "Status" : "Compliance"}</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.isLoading ? (
                <TableRow><TableCell colSpan={currentLevel === "section" ? 5 : 8} style={{ padding: 30, textAlign: "center", color: colors.faint }}>Loading dashboard…</TableCell></TableRow>
              ) : dashboard.isError ? (
                <TableRow><TableCell colSpan={currentLevel === "section" ? 5 : 8} style={{ padding: 30, textAlign: "center", color: colors.red }}>Could not load dashboard data{dashboard.error?.message ? `: ${dashboard.error.message}` : "."}</TableCell></TableRow>
              ) : !scopeNode ? (
                <TableRow><TableCell colSpan={currentLevel === "section" ? 5 : 8} style={{ padding: 30, textAlign: "center", color: colors.faint }}>Your assigned {UNIT_LABELS[scopeLevel].singular.toLowerCase()} was not included in the API response.</TableCell></TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow><TableCell colSpan={currentLevel === "section" ? 5 : 8} style={{ padding: 30, textAlign: "center", color: colors.faint }}>No {tableLabels.plural.toLowerCase()} were returned for this unit.</TableCell></TableRow>
              ) : visibleRows.map((row) => {
                const pct = row.compliance_percentage;
                const complianceColor = (row.pending_approval ?? 0) > 0 ? colors.amber : pct !== null && pct >= 90 ? colors.green : pct !== null && pct >= 70 ? colors.amber : colors.red;
                const isCellView = currentLevel === "section" && tableLevel === "cell";
                const isPending = row.isCell && !row.isMissing && row.approvalStatus === "PENDING";
                return (
                  <TableRow key={row.id} tabIndex={row.hasChildren || isCellView ? 0 : undefined} onClick={() => isCellView ? setSelectedCell(row) : drillInto(row)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") isCellView ? setSelectedCell(row) : drillInto(row); }} style={{ background: "#fff", cursor: row.hasChildren || isCellView ? "pointer" : "default" }}>
                    <TableCell style={{ paddingTop: 16, paddingBottom: 16 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.015em", color: colors.ink }}>{row.name}</span>
                          {(row.chronic_cells_count ?? 0) > 0 && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 5, background: colors.redSoft, color: colors.red, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", padding: "4px 8px", textTransform: "uppercase" }}>{row.chronic_cells_count} chronic cells</span>}
                        </div>
                        {(row.code || row.cellCount !== null) && (
                          <div style={{ fontSize: 11.5, color: colors.faint }}>
                            {[row.code, row.cellCount === null ? null : `${row.cellCount} ${row.cellCount === 1 ? "cell" : "cells"}`].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {currentLevel === "section" && tableLevel === "cell" ? (
                      <>
                        <TableCell style={{ color: colors.ink, fontSize: 12.5, fontWeight: 500 }}>{row.leader ?? "-"}</TableCell>
                        <TableCell style={{ color: colors.muted, fontSize: 12.5 }}>
                          {row.leaderPhone ? <a href={`tel:${row.leaderPhone}`} onClick={(event) => event.stopPropagation()}>{row.leaderPhone}</a> : "-"}
                        </TableCell>
                        <TableCell style={{ color: colors.muted, fontSize: 12.5 }}>
                          {row.leaderEmail ? <a href={`mailto:${row.leaderEmail}`} onClick={(event) => event.stopPropagation()}>{row.leaderEmail}</a> : "-"}
                        </TableCell>
                        <TableCell>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6, background: row.isMissing ? colors.redSoft : isPending ? colors.amberSoft : colors.greenSoft, color: row.isMissing ? colors.red : isPending ? colors.amber : colors.green, whiteSpace: "nowrap" }}>
                            {row.isMissing ? "Not submitted" : selectedCell?.id === row.id && selectedReport ? selectedReport.approval_status.replaceAll("_", " ") : row.approvalStatus ? row.approvalStatus.replaceAll("_", " ") : "Submitted"}
                          </span>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell style={{ color: colors.muted, fontWeight: 500 }}>{row.leader ?? "-"}</TableCell>
                        <TableCell style={{ color: colors.muted, fontSize: 12.5 }}>
                          {row.leaderPhone ? <a href={`tel:${row.leaderPhone}`} onClick={(event) => event.stopPropagation()}>{row.leaderPhone}</a> : "-"}
                        </TableCell>
                        <TableCell style={{ color: colors.muted, fontSize: 12.5, wordBreak: "break-all" }}>
                          {row.leaderEmail ? <a href={`mailto:${row.leaderEmail}`} onClick={(event) => event.stopPropagation()}>{row.leaderEmail}</a> : "-"}
                        </TableCell>
                        <TableCell style={{ color: colors.green, fontWeight: 700, textAlign: "center" }}>{displayCount(row.approved)}</TableCell>
                        <TableCell style={{ color: colors.amber, fontWeight: 700, textAlign: "center" }}>{displayCount(row.pending_approval)}</TableCell>
                        <TableCell style={{ color: row.isMissing ? colors.red : colors.muted, fontWeight: 700, textAlign: "center" }}>{displayCount(row.missing_cells_count)}</TableCell>
                        <TableCell>
                          {row.isCell ? <span style={{ color: row.isMissing ? colors.red : isPending ? colors.amber : colors.green, fontWeight: 600 }}>{row.isMissing ? "Not submitted" : "Submitted"}</span> : pct === null ? "-" : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ minWidth: 42, fontWeight: 700, fontSize: 13, color: complianceColor }}>{Math.round(pct)}%</span>
                              <div style={{ width: 88, height: 6, background: colors.border, borderRadius: 999, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: "100%", background: complianceColor }} />
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {currentLevel === "section" && tableLevel === "cell" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${colors.border}`, padding: "12px 20px" }}>
              <span style={{ color: colors.muted, fontSize: 12 }}>Page {page} of {totalPages} · {totalRows} cells</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} padding="6px 10px" fontSize={12}>Previous</Button>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} padding="6px 10px" fontSize={12}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      <ReportDetailDialog
        report={reportDetail.data ?? null}
        open={selectedCell !== null}
        loading={scopedReports.isLoading || (!!selectedReport && reportDetail.isLoading)}
        cellName={selectedCell?.name}
        serviceDate={serviceDate}
        noReport={selectedCell?.isMissing ?? false}
        error={scopedReports.isError || reportDetail.isError ? "Could not load this cell's report details." : undefined}
        onOpenChange={(open) => { if (!open) setSelectedCell(null); }}
      />
    </>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "amber" | "red";
}) {
  const color = tone === "green" ? colors.green : tone === "amber" ? colors.amber : colors.red;

  return (
    <Card style={{ padding: "18px 18px 16px", minHeight: 140 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: colors.faint }}>
        {label}
      </div>
      <div style={{ fontSize: 32, letterSpacing: "-0.05em", lineHeight: 1.1, color, marginTop: 14, fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 12, lineHeight: 1.5 }}>{detail}</div>
    </Card>
  );
}

function ComplianceMetricCard({
  value,
  hasPending,
  trend,
  loading,
}: {
  value: number | null;
  hasPending: boolean;
  trend: { service_date: string; compliance_percentage: number }[];
  loading: boolean;
}) {
  const tone = hasPending ? "amber" : value !== null && value >= 90 ? "green" : value !== null && value >= 70 ? "amber" : "red";
  const color = tone === "green" ? colors.green : tone === "amber" ? colors.amber : colors.red;

  return (
    <Card style={{ padding: "18px 18px 16px", minHeight: 140 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: colors.faint }}>
        Compliance
      </div>
      <div style={{ fontSize: 32, letterSpacing: "-0.05em", lineHeight: 1.1, color, marginTop: 9, fontWeight: 700 }}>
        {value === null ? "-" : `${Math.round(value)}%`}
      </div>
      <div aria-label="Compliance for the last eight Sundays" style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 4, height: 38, alignItems: "end", marginTop: 9 }}>
        {loading || trend.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", height: 1, background: colors.border }} />
        ) : trend.slice(-8).map((point) => {
          const percentage = Math.min(100, Math.max(0, point.compliance_percentage));
          const date = new Date(`${point.service_date}T00:00:00`);
          const label = date.toLocaleDateString("en", { month: "short", day: "numeric" });
          return (
            <div key={point.service_date} title={`${label}: ${Math.round(percentage)}%`} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", minWidth: 0 }}>
              <div style={{ width: "100%", height: `${Math.max(3, percentage * 0.72)}%`, minHeight: 3, borderRadius: "2px 2px 0 0", background: point === trend[trend.length - 1] ? color : "#DDE1E7" }} />
              <span style={{ fontSize: 8, lineHeight: "10px", color: colors.faint2, marginTop: 2 }}>{label.split(" ")[1]}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10.5, color: colors.faint2, marginTop: 4 }}>Last 8 Sundays</div>
    </Card>
  );
}
