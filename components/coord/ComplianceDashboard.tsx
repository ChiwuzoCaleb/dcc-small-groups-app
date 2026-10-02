"use client";

import { useApp } from "@/lib/state";
import { colors, mono } from "@/lib/tokens";
import { Button, Card, Chip } from "@/components/ui";
import { deriveDashboard, DashFilter } from "@/lib/dashboard";
import type { Scope } from "@/lib/tree";
import { titleFor } from "@/lib/tree";

const FILTERS: DashFilter[] = ["All", "Not submitted", "Pending approval", "Chronic"];

export function ComplianceDashboard() {
  const { state, set } = useApp();
  const d = deriveDashboard(state.scope, state.path, state.filter);

  return (
    <div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${colors.border}`, padding: "22px 28px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: colors.faint, marginBottom: 7, flexWrap: "wrap" }}>
              {d.crumbs.map((c, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <span
                    onClick={() => set({ path: state.path.slice(0, c.index) })}
                    style={{ cursor: "pointer", whiteSpace: "nowrap", color: c.isLast ? colors.ink : colors.faint, fontWeight: c.isLast ? 600 : 400 }}
                  >
                    {c.name}
                  </span>
                  {!c.isLast && <span style={{ color: colors.neutral }}>›</span>}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.15 }}>{d.node.name}</div>
            <div style={{ fontSize: 13, color: colors.muted, marginTop: 5 }}>
              {titleFor(d.node.level)} {d.node.leader} · {d.node.cells} {d.node.cells === 1 ? "cell" : "cells"} in scope
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${colors.borderStrong}`, borderRadius: 10, padding: "8px 12px", background: "#fff", fontSize: 12.5, fontWeight: 500 }}>
              <span style={{ color: colors.faint }}>Service date</span>
              <span style={{ fontWeight: 600 }}>Sun 23 Aug 2026</span>
            </div>
            <Button variant="secondary" padding="9px 13px" fontSize={12.5}>Export CSV</Button>
            <Button variant="dark" padding="9px 13px" fontSize={12.5}>Export PDF</Button>
          </div>
        </div>
      </div>

      <div style={{ padding: "22px 28px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
          <Card style={{ padding: "17px 18px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: colors.faint, marginBottom: 12 }}>Compliance</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, color: d.pctColor }}>{d.pctNum}%</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: d.deltaColor }}>{d.delta}</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 30, marginTop: 14 }}>
              {d.trend.map((b, i) => (
                <div key={i} style={{ flex: 1, borderRadius: "2px 2px 0 0", minHeight: 3, height: b.h, background: b.bg }} />
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: colors.faint2, marginTop: 7 }}>Last 8 Sundays</div>
          </Card>
          {d.stats.map((s) => (
            <Card key={s.label} style={{ padding: "17px 18px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: colors.faint, marginBottom: 12 }}>{s.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: colors.faint2 }}>{s.unit}</div>
              </div>
              <div style={{ fontSize: 11.5, color: colors.faint, marginTop: "auto", paddingTop: 14, lineHeight: 1.45 }}>{s.note}</div>
            </Card>
          ))}
        </div>

        <Card style={{ overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.hairline}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", minWidth: 820 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.015em" }}>{d.tableTitle}</div>
              <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 2 }}>{d.tableSub}</div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {FILTERS.map((f) => (
                <Chip key={f} label={f} active={state.filter === f} onClick={() => set({ filter: f })} />
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 76px 76px 82px 1.1fr", padding: "10px 20px", minWidth: 820, background: colors.fieldBg, borderBottom: `1px solid ${colors.hairline}` }}>
            {d.headers.map((h, i) => (
              <div key={i} style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: colors.faint2, textAlign: h.align }}>{h.label}</div>
            ))}
          </div>

          {d.rows.map((r) => (
            <div
              key={r.key}
              onClick={() => r.onPickIndex !== null && set({ path: [...state.path, r.onPickIndex] })}
              style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 76px 76px 82px 1.1fr", padding: "14px 20px", minWidth: 820, borderBottom: `1px solid ${colors.hairline2}`, alignItems: "center", cursor: "pointer" }}
            >
              <div style={{ minWidth: 0, paddingRight: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.015em" }}>{r.name}</span>
                  {r.chronic && <span style={{ fontSize: 10, fontWeight: 700, padding: "2.5px 6px", borderRadius: 5, background: colors.redSoft, color: colors.red, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{r.chronicText}</span>}
                </div>
                <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 2 }}>{r.sub}</div>
              </div>
              <div style={{ minWidth: 0, paddingRight: 12, fontSize: 12.5, color: colors.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.leader}</div>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, fontFamily: mono, color: colors.green }}>{r.ok}</div>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, fontFamily: mono, color: colors.amber }}>{r.pending}</div>
              <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, fontFamily: mono, color: r.missColor }}>{r.missing}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end" }}>
                {r.isCell && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 6, whiteSpace: "nowrap", background: r.stBg, color: r.stFg }}>{r.stLabel}</span>
                )}
                {r.isGroupRow && (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", justifyContent: "flex-end" }}>
                    <div style={{ flex: 1, maxWidth: 96, height: 6, background: "#EDEFF3", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: r.pct, background: r.barBg }} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: mono, minWidth: 42, textAlign: "right", color: r.pctFg }}>{r.pct}</span>
                    <span style={{ fontSize: 14, color: colors.neutral }}>›</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {d.noRows && (
            <div style={{ padding: "44px 20px", textAlign: "center", fontSize: 13, color: colors.faint }}>Nothing matches this filter at this level.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
