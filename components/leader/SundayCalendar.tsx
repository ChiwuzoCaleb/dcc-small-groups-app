"use client";

import { useMemo, useState } from "react";
import { colors } from "@/lib/tokens";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_BACK = 12;

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

/**
 * Month calendar where only Sundays up to `latestSunday` can be chosen.
 * Sundays in `reported` are shown but inert; everything else is disabled.
 */
export function SundayCalendar({
  latestSunday,
  reported,
  resubmittable,
  selected,
  onSelect,
}: {
  latestSunday: string;
  reported: ReadonlySet<string>;
  resubmittable: ReadonlySet<string>;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const latest = useMemo(() => new Date(`${latestSunday}T00:00:00Z`), [latestSunday]);
  const [view, setView] = useState({ y: latest.getUTCFullYear(), m: latest.getUTCMonth() });

  const earliest = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() - MONTHS_BACK, 1));
  const monthIndex = (y: number, m: number) => y * 12 + m;
  const canPrev = monthIndex(view.y, view.m) > monthIndex(earliest.getUTCFullYear(), earliest.getUTCMonth());
  const canNext = monthIndex(view.y, view.m) < monthIndex(latest.getUTCFullYear(), latest.getUTCMonth());

  const shift = (delta: number) =>
    setView(({ y, m }) => {
      const next = new Date(Date.UTC(y, m + delta, 1));
      return { y: next.getUTCFullYear(), m: next.getUTCMonth() };
    });

  const firstWeekday = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const monthLabel = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const navButton = (label: string, disabled: boolean, onClick: () => void, glyph: string) => (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: "#fff",
        color: colors.ink,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div style={{ width: "100%", maxWidth: 360 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        {navButton("Previous month", !canPrev, () => shift(-1), "‹")}
        <span style={{ fontSize: 14, fontWeight: 600, color: colors.ink }}>{monthLabel}</span>
        {navButton("Next month", !canNext, () => shift(1), "›")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", color: colors.faint, padding: "4px 0" }}>
            {d.toUpperCase()}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const value = iso(view.y, view.m, day);
          const isSunday = new Date(`${value}T00:00:00Z`).getUTCDay() === 0;
          const inRange = value <= latestSunday;
          const done = reported.has(value);
          const redo = resubmittable.has(value);
          const selectable = isSunday && inRange && (!done || redo);
          const isSelected = selected === value;
          return (
            <button
              key={value}
              type="button"
              disabled={!selectable}
              aria-pressed={isSelected}
              aria-label={`${value}${done && !redo ? " (already reported)" : redo ? " (sent back, resubmit)" : ""}`}
              onClick={() => onSelect(value)}
              style={{
                height: 40,
                borderRadius: 8,
                border: `1px solid ${isSelected ? colors.red : redo ? colors.amber : "transparent"}`,
                background: isSelected ? colors.red : done && !redo ? colors.greenSoft : "transparent",
                color: isSelected ? "#fff" : done && !redo ? colors.green : selectable ? colors.ink : colors.faint2,
                fontWeight: selectable ? 700 : 400,
                fontSize: 13,
                cursor: selectable ? "pointer" : "default",
                pointerEvents: selectable ? "auto" : "none",
                opacity: selectable || done ? 1 : 0.45,
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12, fontSize: 11.5, color: colors.muted }}>
        <span>Bold = open Sunday</span>
        <span style={{ color: colors.green }}>Green = already reported</span>
        <span style={{ color: colors.amber }}>Amber outline = sent back</span>
      </div>
    </div>
  );
}
