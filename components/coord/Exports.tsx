"use client";

import { useApp } from "@/lib/state";
import { colors } from "@/lib/tokens";
import { Button, Card, Chip } from "@/components/ui";
import type { Scope } from "@/lib/tree";
import { EXPORT_SET_DEFS, EXPORT_RECENT } from "@/lib/data";

const PERIODS = ["Last Sunday", "Last 4 Sundays", "Quarter to date", "Year to date"];

export function Exports() {
  const { state, set } = useApp();

  const toggleSet = (label: string) => {
    const on = state.expSets.indexOf(label) !== -1;
    set({ expSets: on ? state.expSets.filter((x) => x !== label) : [...state.expSets, label] });
  };

  const expRun = () => {
    set({ expState: "running" });
    setTimeout(() => set({ expState: "idle" }), 1200);
  };

  const expLabel = state.expState === "running" ? "Preparing…" : `Generate ${state.expFmt}`;
  const expRowNote = `${state.expSets.length} dataset${state.expSets.length === 1 ? "" : "s"} · ${state.expScope} · ${state.expPeriod}`;

  return (
    <div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${colors.border}`, padding: "22px 28px" }}>
        <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.035em" }}>Exports</div>
        <div style={{ fontSize: 13, color: colors.muted, marginTop: 5 }}>Pull the same figures the dashboard shows into a CSV or PDF for board and pastoral reporting.</div>
      </div>

      <div style={{ padding: "22px 28px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(336px,1fr))", gap: 20, alignItems: "start" }}>
        <Card style={{ padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 18 }}>Build an export</div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 9 }}>Period</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {PERIODS.map((p) => (
              <Chip key={p} label={p} active={state.expPeriod === p} onClick={() => set({ expPeriod: p })} />
            ))}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 9 }}>Include</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
            {EXPORT_SET_DEFS.map((d) => {
              const on = state.expSets.indexOf(d.label) !== -1;
              return (
                <div
                  key={d.label}
                  onClick={() => toggleSet(d.label)}
                  style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: `1.5px solid ${on ? colors.red : colors.border}`, borderRadius: 12, cursor: "pointer", background: on ? colors.redSoft : "#fff" }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${on ? colors.red : colors.chipGreyBorder}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: on ? colors.red : "transparent" }}>
                    {on ? "✓" : ""}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{d.label}</div>
                    <div style={{ fontSize: 11.5, color: colors.faint, lineHeight: 1.4 }}>{d.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", paddingTop: 18, borderTop: `1px solid ${colors.hairline}` }}>
            <Button variant="primary" onClick={expRun} disabled={state.expState === "running"} padding="13px 20px" fontSize={14}>{expLabel}</Button>
            <Button variant="secondary" onClick={() => set({ expFmt: state.expFmt === "CSV" ? "PDF" : "CSV" })} padding="12px 16px" fontSize={13.5}>
              Format: {state.expFmt}
            </Button>
            <span style={{ fontSize: 12, color: colors.faint }}>{expRowNote}</span>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.hairline}`, fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.015em" }}>Recent exports</div>
            {EXPORT_RECENT.map((e) => (
              <div key={e.name} style={{ padding: "13px 20px", borderBottom: `1px solid ${colors.hairline2}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.faint }}>{e.meta}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6, flexShrink: 0, fontFamily: "var(--font-plex-mono), monospace", background: e.kind === "PDF" ? colors.redSoft : colors.chipGrey, color: e.kind === "PDF" ? colors.red : colors.muted }}>
                  {e.kind}
                </span>
                <Button variant="secondary" padding="6px 10px" fontSize={11.5}>Download</Button>
              </div>
            ))}
          </Card>
          <Card style={{ padding: "20px 22px" }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.015em", marginBottom: 4 }}>Scheduled</div>
            <div style={{ fontSize: 12.5, color: colors.muted, lineHeight: 1.6, marginBottom: 16 }}>
              A regional compliance summary is emailed to the pastorate every Wednesday at 6:00am, after the reporting window closes.
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
              <Button variant="secondary" padding="11px 15px" fontSize={13}>Edit schedule</Button>
              <Button variant="secondary" padding="11px 15px" fontSize={13}>Add recipient</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
