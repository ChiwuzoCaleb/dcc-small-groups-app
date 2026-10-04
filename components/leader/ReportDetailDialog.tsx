"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/leader/StatusPill";
import { CAPABILITIES, isRoleName } from "@/lib/auth/roles";
import { FIGURE_LABEL, REPORT_STEPS, type FigureKey } from "@/lib/reports/fields";
import type { ReportCell, ReportOrgUnit, ReportUser, SundayReport } from "@/lib/api/types";

function fullDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `currency` arrives as "NGN" on most rows but "₦" on some, so only feed real ISO codes to Intl. */
function formatMoney(amount: number, currency?: string): string {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
    } catch {
      /* fall through */
    }
  }
  return `${currency ?? ""} ${amount.toLocaleString()}`.trim();
}

function humanize(value?: string | null): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function personLabel(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const u = value as ReportUser;
    return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || u.id || null;
  }
  return null;
}

/** `approved_by` is only a user ID; the approver's details live on the hierarchy leaders embedded in the report. */
function approverName(
  approvedBy: unknown,
  units: (ReportOrgUnit | null | undefined)[],
): string | null {
  if (!approvedBy) return null;
  if (typeof approvedBy === "object") return personLabel(approvedBy);
  const leader = units.map((u) => u?.leader).find((l) => l?.id === approvedBy);
  if (!leader) return null;
  return [leader.first_name, leader.last_name].filter(Boolean).join(" ") || leader.email || null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children ?? "—"}</dd>
    </div>
  );
}

function Person({ user }: { user?: ReportUser | null }) {
  if (!user) return <span className="text-muted-foreground">—</span>;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "—";
  const role = isRoleName(user.role) ? CAPABILITIES[user.role].label : humanize(user.role);
  return (
    <div className="min-w-0 text-sm">
      <div className="font-medium">
        {name} <span className="font-normal text-muted-foreground">· {role}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {user.email && (
          <a href={`mailto:${user.email}`} className="hover:underline">
            {user.email}
          </a>
        )}
        {user.phone_number && (
          <a href={`tel:${user.phone_number}`} className="hover:underline">
            {user.phone_number}
          </a>
        )}
      </div>
    </div>
  );
}

function OrgRow({ level, unit }: { level: string; unit?: ReportOrgUnit | null }) {
  if (!unit) return null;
  return (
    <div className="grid gap-1 rounded-lg border p-3 sm:grid-cols-[110px_1fr] sm:gap-3">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{level}</div>
      <div className="min-w-0 space-y-1.5">
        <div className="text-sm font-medium">
          {unit.name ?? "—"}
          {unit.code && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{unit.code}</span>}
        </div>
        <Person user={unit.leader} />
      </div>
    </div>
  );
}

export function ReportDetailDialog({
  report,
  onOpenChange,
  open,
  loading = false,
  cellName,
  serviceDate,
  notice,
  error,
  noReport = false,
}: {
  /** The report to show; `null` keeps the dialog closed. */
  report: SundayReport | null;
  onOpenChange: (open: boolean) => void;
  open?: boolean;
  loading?: boolean;
  cellName?: string;
  serviceDate?: string;
  notice?: string;
  error?: string;
  noReport?: boolean;
}) {
  const dialogOpen = open ?? report !== null;
  const cell: ReportCell | null = report && typeof report.cell === "object" ? report.cell : null;
  const cellRef = report && typeof report.cell === "string" ? report.cell : null;

  const figureGroups = REPORT_STEPS.filter((s) => s.fields.length > 0)
    .map((step) => ({
      category: step.category,
      entries: step.fields
        .map((f) => ({ key: f.key as FigureKey, label: FIGURE_LABEL[f.key as FigureKey] ?? f.label, value: report?.[f.key as FigureKey] }))
        .filter((e): e is { key: FigureKey; label: string; value: number } => typeof e.value === "number"),
    }))
    .filter((g) => g.entries.length > 0);

  const section = cell?.section;
  const area = section?.area;
  const zone = area?.zone;
  const district = zone?.district;
  const region = district?.region;

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      {report ? (
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b p-5 pr-12">
            <DialogTitle className="text-base">
              Sunday report · {fullDate(report.service_date)}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{cell?.name ?? "Your cell"}</span>
              {cell?.code && <span className="font-mono text-xs">{cell.code}</span>}
              <StatusPill status={report.approval_status} />
            </DialogDescription>
          </DialogHeader>

          {report.meeting_held === false ? (
            <div className="space-y-5 p-5">
              <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                No meeting was held on this service date.
              </p>
              <Section title="Cell Leader's comment">
                {report.comment ? (
                  <p className="rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {report.comment}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No comment was added.</p>
                )}
              </Section>
            </div>
          ) : (
            <div className="flex-1 space-y-7 overflow-y-auto p-5">
              {notice && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">{notice}</p>}
              <Section title="Overview">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Field label="Service date">{fullDate(report.service_date)}</Field>
                  <Field label="Meeting held">
                    {report.meeting_held === undefined ? "—" : report.meeting_held ? "Yes" : "No"}
                  </Field>
                  <Field label="Status">{humanize(report.approval_status)}</Field>
                  <Field label="Submitted">{dateTime(report.date_created)}</Field>
                  <Field label="Last updated">{dateTime(report.last_updated)}</Field>
                  <Field label="Approved by">{approverName(report.approved_by, [cell, section, area, zone, district, region])}</Field>
                  <Field label="Approved at">{dateTime(report.approved_at)}</Field>
                  {cellRef && <Field label="Cell">{cellRef}</Field>}
                </dl>
              </Section>

              <Section title="Comment">
                {report.comment ? (
                  <p className="rounded-lg bg-muted px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                    {report.comment}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No comment was added.</p>
                )}
              </Section>

              {figureGroups.length === 0 ? (
                <Section title="Figures">
                  <p className="text-sm text-muted-foreground">No figures were recorded.</p>
                </Section>
              ) : (
                figureGroups.map((group) => (
                  <Section key={group.category} title={group.category}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {group.entries.map((e) => (
                        <div key={e.key} className="rounded-lg border px-3 py-2">
                          <div className="font-mono text-base font-semibold">
                            {e.key === "total_offering" ? formatMoney(e.value, report.currency) : e.value}
                          </div>
                          <div className="text-[11px] leading-tight text-muted-foreground">{e.label}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                ))
              )}

              {cell && (
                <Section title="Cell">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <Field label="Name">{cell.name}</Field>
                    <Field label="Code">{cell.code}</Field>
                    <Field label="Type">{humanize(cell.cell_type)}</Field>
                    <Field label="Status">{humanize(cell.status)}</Field>
                    {cell.cell_id && <Field label="Cell ID">{cell.cell_id}</Field>}
                    <div className="col-span-2 min-w-0 sm:col-span-3">
                      <Field label="Address">{cell.address}</Field>
                    </div>
                    <Field label="Latitude">{cell.latitude ?? undefined}</Field>
                    <Field label="Longitude">{cell.longitude ?? undefined}</Field>
                  </dl>
                  <div className="mt-4">
                    <div className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      Cell leader
                    </div>
                    <Person user={cell.leader} />
                  </div>
                </Section>
              )}

              {(section || area || zone || district || region) && (
                <Section title="Hierarchy">
                  <div className="space-y-2">
                    <OrgRow level="Section" unit={section} />
                    <OrgRow level="Area" unit={area} />
                    <OrgRow level="Zone" unit={zone} />
                    <OrgRow level="District" unit={district} />
                    <OrgRow level="Region" unit={region} />
                  </div>
                </Section>
              )}
            </div>
          )}
        </DialogContent>
      ) : dialogOpen ? (
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-5 pr-12">
            <DialogTitle className="text-base">Cell report</DialogTitle>
            <DialogDescription>{cellName ?? "Selected cell"} · {fullDate(serviceDate)}</DialogDescription>
          </DialogHeader>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading report details…</p>
            ) : error ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            ) : noReport ? (
              <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
                This cell has not submitted a report for the selected week.
              </p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No report details are available for this cell and selected week.
              </p>
            )}
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
