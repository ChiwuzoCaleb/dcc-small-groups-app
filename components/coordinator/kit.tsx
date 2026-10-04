"use client";

/**
 * Small presentational pieces shared by the coordinator screens. Kept in the
 * house inline-style idiom (see app/cell/page.tsx) — no design-system churn.
 */

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Card } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { colors, mono } from "@/lib/tokens";
import { lastClosedSundays, formatServiceDate, mostRecentSunday } from "@/lib/dates";
import type { NonSubmitterRow } from "@/lib/api/types";

export function complianceColor(pct: number): string {
  if (pct >= 90) return colors.green;
  if (pct >= 70) return colors.amber;
  return colors.red;
}

// ---------------------------------------------------------------------------
// Non-submitter row accessors
//
// The backend's API reference documents `non-submitters/` rows as just
// `{id, name, code}` — thinner than the `cell_name`/`section`/
// `consecutive_misses`/`chronic` shape this was first built against. These
// read the documented fields first and fall back to the older guesses in case
// the live payload carries more than the doc's example.
// ---------------------------------------------------------------------------

export function nonSubmitterKey(r: NonSubmitterRow, index: number): string {
  return r.id ?? (r.cell as string | undefined) ?? String(index);
}

export function nonSubmitterName(r: NonSubmitterRow): string {
  return r.name ?? r.cell_name ?? (r.cell as string | undefined) ?? "—";
}

export function nonSubmitterCode(r: NonSubmitterRow): string {
  return r.code ?? (r.cell_code as string | undefined) ?? "—";
}

/**
 * Whether to badge a row "Chronic". `consecutive_misses`/`chronic` aren't in
 * the documented response, so when the list itself is already server-filtered
 * to chronic-only (`chronicView`), every row is chronic regardless of what
 * per-row fields do or don't exist; otherwise fall back to those fields.
 */
export function nonSubmitterIsChronic(r: NonSubmitterRow, chronicView: boolean): boolean {
  if (chronicView) return true;
  return r.chronic ?? (r.consecutive_misses ?? 0) >= 3;
}

/** "+3 pts" / "-4 pts" / "±0 pts", colored — the change vs. the previous point in a trend. */
export function deltaFromTrend(points: { value: number }[]): { text: string; color: string } | null {
  if (points.length < 2) return null;
  const diff = Math.round(points[points.length - 1].value - points[points.length - 2].value);
  if (diff === 0) return { text: "±0 pts", color: colors.faint };
  return { text: `${diff > 0 ? "+" : ""}${diff} pts`, color: diff > 0 ? colors.green : colors.red };
}

/** Whole/half-hour phrasing for a fallback-approval window ("36 hours", "1.5 hours"). */
export function formatHours(seconds: number): string {
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** First + last name from the `/api/auth/session` profile, for a personal subtitle. */
export function displayNameFrom(user: Record<string, unknown> | null | undefined): string | null {
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter((v) => typeof v === "string" && v).join(" ");
  return name || null;
}

/** The Cell Leader's cell from the login profile (`code` is null until the backend returns it; `cell` is `{id, name}`). */
export function cellFrom(user: Record<string, unknown> | null | undefined): { code: string | null; name: string | null; id: string | null } {
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const cell = user?.cell && typeof user.cell === "object" ? (user.cell as Record<string, unknown>) : null;
  return {
    code: text(user?.cell_code) ?? text(cell?.code) ?? text(cell?.cell_code),
    name: text(cell?.name),
    id: text(cell?.id),
  };
}

/** The most recent Sunday (today, if today is Sunday), as YYYY-MM-DD. */
export function defaultServiceDate(): string {
  return mostRecentSunday(new Date()).toISOString().slice(0, 10);
}

/** The last `count` closed Sundays as `{ value: YYYY-MM-DD, label }`, most recent first. */
export function recentSundayOptions(count = 8): { value: string; label: string }[] {
  return lastClosedSundays(count, new Date()).map((d) => ({
    value: d.toISOString().slice(0, 10),
    label: formatServiceDate(d),
  }));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseISO(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Header date control: opens a month calendar where only Sundays up to the latest closed one are selectable. */
export function ServiceDatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const latest = defaultServiceDate();
  const selected = parseISO(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({ y: selected.getUTCFullYear(), m: selected.getUTCMonth() }));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const latestDate = parseISO(latest);
  const atLatestMonth = view.y === latestDate.getUTCFullYear() && view.m === latestDate.getUTCMonth();
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: first.getUTCDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const navBtn: CSSProperties = {
    border: `1px solid ${colors.borderStrong}`,
    background: "#fff",
    borderRadius: 8,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 14,
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) setView({ y: selected.getUTCFullYear(), m: selected.getUTCMonth() });
          setOpen((o) => !o);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: 10,
          padding: "8px 12px",
          background: "#fff",
          fontSize: 12.5,
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <span style={{ color: colors.faint }}>Service Sunday</span>
        <span style={{ fontWeight: 600, fontFamily: mono }}>
          {selected.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}
        </span>
        <span aria-hidden style={{ fontSize: 10 }}>{"\u25BE"}</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Select service Sunday"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 50,
            width: 280,
            padding: 12,
            background: "#fff",
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} style={navBtn}>{"\u2039"}</button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{MONTHS[view.m]} {view.y}</span>
            <button
              type="button"
              aria-label="Next month"
              disabled={atLatestMonth}
              onClick={() => shift(1)}
              style={{ ...navBtn, opacity: atLatestMonth ? 0.35 : 1, cursor: atLatestMonth ? "default" : "pointer" }}
            >
              {"\u203A"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center" }}>
            {WEEKDAYS.map((w) => (
              <span key={w} style={{ fontSize: 10.5, color: colors.faint, padding: "4px 0" }}>{w}</span>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <span key={`b${i}`} />;
              const iso = new Date(Date.UTC(view.y, view.m, day)).toISOString().slice(0, 10);
              const isSunday = (first.getUTCDay() + day - 1) % 7 === 0;
              const enabled = isSunday && iso <= latest;
              const isSelected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!enabled}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  style={{
                    height: 32,
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12.5,
                    fontWeight: enabled ? 600 : 400,
                    background: isSelected ? colors.ink : "transparent",
                    color: isSelected ? "#fff" : enabled ? colors.ink : colors.faint,
                    opacity: enabled ? 1 : 0.35,
                    cursor: enabled ? "pointer" : "default",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
export function StatTile({
  label,
  value,
  hint,
  color = colors.ink,
  delta,
  trend,
  loading = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  color?: string;
  /** Small colored "+3 pts" / "-4 pts" shown right next to the value. */
  delta?: { text: string; color: string } | null;
  /** An optional `BarStrip` (or similar) rendered below the value, above the hint. */
  trend?: ReactNode;
  loading?: boolean;
}) {
  return (
    <Card style={{ padding: "17px 18px", display: "flex", flexDirection: "column", minHeight: 108 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.09em",
          textTransform: "uppercase",
          color: colors.faint,
          marginBottom: 12,
        }}
      >
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, fontFamily: mono, color }}>
            {value}
          </div>
          {delta && (
            <div style={{ fontSize: 12, fontWeight: 600, color: delta.color }}>{delta.text}</div>
          )}
        </div>
      )}
      {trend && !loading && <div style={{ marginTop: 14 }}>{trend}</div>}
      {hint && (
        <div style={{ fontSize: 11.5, color: colors.faint, marginTop: "auto", paddingTop: 12, lineHeight: 1.45 }}>
          {loading ? <Skeleton className="h-3 w-32" /> : hint}
        </div>
      )}
    </Card>
  );
}

/** A horizontal bar strip — one bar per data point, height ∝ value (0–100). */
export function BarStrip({
  points,
  height = 40,
  colorFor,
}: {
  points: { value: number; label?: string }[];
  height?: number;
  colorFor?: (value: number) => string;
}) {
  const max = Math.max(100, ...points.map((p) => p.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
      {points.length === 0 && (
        <div style={{ fontSize: 11.5, color: colors.faint2 }}>No data for this range yet.</div>
      )}
      {points.map((p, i) => (
        <div
          key={i}
          title={p.label ? `${p.label}: ${p.value}%` : `${p.value}%`}
          style={{
            flex: 1,
            minWidth: 3,
            borderRadius: "2px 2px 0 0",
            minHeight: 3,
            height: `${Math.max(4, (p.value / max) * 100)}%`,
            background: colorFor ? colorFor(p.value) : colors.neutral,
          }}
        />
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  sub,
  right,
  children,
  style,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <Card style={{ padding: 0, ...style }}>
      <div
        style={{
          padding: "15px 20px",
          borderBottom: `1px solid ${colors.hairline}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.015em" }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 2 }}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <Card style={{ padding: 18, background: colors.redSoft, borderColor: colors.redSoftBorder }}>
      <div style={{ fontSize: 13, color: colors.red }}>{message}</div>
    </Card>
  );
}
