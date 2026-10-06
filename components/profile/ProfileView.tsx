"use client";

import { Card, PageHeader } from "@/components/ui";
import { HierarchyList, type Hierarchy } from "@/components/profile/HierarchyList";
import { useAuth } from "@/hooks/useAuth";
import { useMyReportsPage } from "@/hooks/api/reports";
import { CAPABILITIES, isRoleName } from "@/lib/auth/roles";
import type { ReportCell, ReportOrgUnit, ReportUser, SundayReport } from "@/lib/api/types";

const LEVELS = ["section", "area", "zone", "district", "region"] as const;

function asUnit(value: unknown): ReportOrgUnit | null {
  return value && typeof value === "object" && "id" in value ? (value as ReportOrgUnit) : null;
}

const text = (v: unknown) => (typeof v === "string" && v ? v : null);

function humanize(value?: string | null): string | null {
  if (!value) return null;
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The signed-in user's own record inside a `reports/mine/` row: the cell leader, or a matching hierarchy leader. */
function findSelf(report: SundayReport | undefined, userId: string | null): ReportUser | null {
  if (!report) return null;
  const cell = typeof report.cell === "object" ? report.cell : null;
  const candidates = [cell?.leader, ...LEVELS.map((l) => asUnit(report[l])?.leader)].filter(Boolean) as ReportUser[];
  if (userId) return candidates.find((u) => u.id === userId) ?? null;
  return cell?.leader ?? null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{value || "—"}</dd>
    </div>
  );
}

/** Account details and hierarchy, populated from the latest `reports/mine/` row. */
export function ProfileView({ eyebrow }: { eyebrow: string }) {
  const { user } = useAuth();
  const record = user as Record<string, unknown> | null;
  const userId = text(record?.id);
  const query = useMyReportsPage(1);
  const latest = query.data?.results?.[0];

  const self = findSelf(latest, userId);
  const cell: ReportCell | null = latest && typeof latest.cell === "object" ? latest.cell : null;

  const hierarchy: Hierarchy = {};
  for (const level of LEVELS) hierarchy[level] = asUnit(latest?.[level]) ?? asUnit(record?.[level]);

  const pick = (key: keyof ReportUser) => text(self?.[key]) ?? text(record?.[key]);
  const name =
    [self?.first_name, self?.last_name].filter(Boolean).join(" ") ||
    [record?.first_name, record?.last_name].filter((v) => typeof v === "string" && v).join(" ");
  const role = pick("role");
  const isCellLeader = role === "CELL_LEADER";

  return (
    <>
      <PageHeader eyebrow={eyebrow} title="Profile" sub="Your account and where you sit in the hierarchy" />
      <div className="dcc-page" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, maxWidth: 800 }}>
        {query.isError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Could not load your details: {query.error.message}
          </p>
        )}
        <Card style={{ padding: 20 }}>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Name" value={name} />
            <Field label="Role" value={isRoleName(role) ? CAPABILITIES[role].label : humanize(role)} />
            <Field label="Email" value={pick("email")} />
            <Field label="Phone" value={pick("phone_number")} />
            <Field label="Code" value={pick("code")} />
            <Field label="Status" value={humanize(pick("status"))} />
          </dl>
        </Card>
        {isCellLeader && cell && (
          <Card style={{ padding: 20 }}>
            <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Cell</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Name" value={cell.name} />
              <Field label="Code" value={cell.code} />
              <Field label="Type" value={humanize(cell.cell_type)} />
              <div className="col-span-2 min-w-0 sm:col-span-3">
                <Field label="Address" value={cell.address} />
              </div>
            </dl>
          </Card>
        )}
        <Card style={{ padding: 20 }}>
          <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Hierarchy</h3>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <HierarchyList hierarchy={hierarchy} />
          )}
        </Card>
      </div>
    </>
  );
}
