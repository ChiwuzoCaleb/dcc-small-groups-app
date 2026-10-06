"use client";

import { useApp } from "@/lib/state";
import { colors, mono } from "@/lib/tokens";
import { Button, Card } from "@/components/ui";
import { HISTORY_BASE, LEADER_TREND, TREND_DATES } from "@/lib/data";

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Approved: { bg: colors.greenSoft, fg: colors.green },
  Rejected: { bg: colors.redSoft, fg: colors.red },
  "Pending Approval": { bg: colors.amberSoft, fg: colors.amber },
  Missing: { bg: colors.redSoft, fg: colors.red },
};

export function LeaderDashboard() {
  const { state, goReport, goFollow } = useApp();

  const awaitingCount = state.people.filter((p) => p.status === "Not contacted").length;
  const homeFollow = state.people
    .filter((p) => p.status === "Not contacted")
    .slice(0, 2)
    .map((p) => ({ ...p, initials: p.name.split(" ").map((x) => x[0]).join("") }));

  const currentRow = {
    date: "23 Aug",
    channel: state.submitted ? "Web · 6:42pm" : "Not submitted",
    label: state.submitted ? "Pending Approval" : "Missing",
  };
  const history = [currentRow, ...HISTORY_BASE];

  const leaderStats = [
    { label: "Members present", value: state.submitted ? Number(state.vals["present"]) || 14 : 14, unit: "of 19", color: colors.ink, note: "Last Sunday, 16 August." },
    { label: "Reporting streak", value: 6, unit: "weeks", color: colors.green, note: "Longest in Ijegun Section 1." },
    { label: "Follow-ups open", value: awaitingCount, unit: "people", color: awaitingCount ? colors.amber : colors.green, note: "One is past the 7-day window." },
  ];

  return (
    <div>
      <div style={{ background: "#fff", borderBottom: `1px solid ${colors.border}`, padding: "22px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11.5, color: colors.faint, marginBottom: 6 }}>Sunday, 23 August 2026</div>
            <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.15 }}>Good evening, Boluwatife</div>
            <div style={{ display: "flex", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 7, background: colors.chipGrey, color: colors.muted }}>Grace Cell</span>
              <span style={{ fontSize: 11.5, fontWeight: 500, padding: "5px 10px", borderRadius: 7, background: colors.chipGrey, color: colors.faint, fontFamily: mono }}>CL-0142</span>
              <span style={{ fontSize: 11.5, fontWeight: 500, padding: "5px 10px", borderRadius: 7, background: colors.chipGrey, color: colors.faint }}>Ijegun Section 1 · Adult</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexShrink: 0 }}>
            <Button variant="secondary" padding="9px 13px" fontSize={12.5}>Cell profile</Button>
            <Button variant="primary" padding="9px 14px" fontSize={12.5} onClick={goReport}>Submit report</Button>
          </div>
        </div>
      </div>

      <div style={{ padding: "22px 28px 40px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(336px,1fr))", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!state.submitted && (
            <Card style={{ borderColor: colors.redSoftBorder, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: colors.red, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.red }}>Due in 2 days</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", marginBottom: 7 }}>Your 23 August report is not in yet</div>
              <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.6, marginBottom: 18 }}>
                Five short categories, about two minutes. The window closes Wednesday 11:59pm; after that your Section Leader has to file it for you.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="primary" onClick={goReport}>Start report</Button>
                <Button variant="secondary" padding="13px 18px">Report on WhatsApp</Button>
              </div>
            </Card>
          )}
          {state.submitted && (
            <Card style={{ borderColor: "#D3E9DD", padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: colors.green, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.green }}>Submitted</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em", marginBottom: 7 }}>23 August report sent for approval</div>
              <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.6, marginBottom: 18 }}>
                Waiting on Tunde Bakare, Ijegun Section 1. You can still edit until it is approved.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={goReport} padding="12px 18px">View submission</Button>
              </div>
            </Card>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {leaderStats.map((s) => (
              <Card key={s.label} style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: colors.faint, marginBottom: 11 }}>{s.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: colors.faint2 }}>{s.unit}</div>
                </div>
                <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 10, lineHeight: 1.45 }}>{s.note}</div>
              </Card>
            ))}
          </div>

          <Card style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.015em" }}>Attendance, last 8 Sundays</div>
              <div style={{ fontSize: 11.5, color: colors.faint }}>Average 14 · cell size 19</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginTop: 18 }}>
              {LEADER_TREND.map((n, i) => {
                const last = i === LEADER_TREND.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, fontFamily: mono, color: last ? colors.red : colors.faint }}>{n}</div>
                    <div style={{ width: "100%", borderRadius: "4px 4px 0 0", minHeight: 4, height: `${Math.round((n / 19) * 100)}%`, background: last ? colors.red : "#DDE2E8" }} />
                    <div style={{ fontSize: 10.5, color: colors.faint2 }}>{TREND_DATES[i]}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.hairline}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.015em" }}>Follow-ups waiting on you</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: colors.redSoft, color: colors.red, fontFamily: mono }}>{awaitingCount}</span>
            </div>
            {homeFollow.map((p) => (
              <div key={p.id} style={{ padding: "14px 20px", borderBottom: `1px solid ${colors.hairline2}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 11, background: colors.chipGrey, color: colors.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  {p.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: colors.faint }}>{p.type} · assigned {p.ago}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: "13px 20px" }}>
              <Button variant="secondary" fullWidth padding="10px" fontSize={12.5} onClick={goFollow}>Open follow-ups</Button>
            </div>
          </Card>

          <Card>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.hairline}` }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.015em" }}>Your submission record</div>
              <div style={{ fontSize: 11.5, color: colors.faint, marginTop: 2 }}>Last five Sundays</div>
            </div>
            {history.map((h, i) => {
              const st = STATUS_STYLE[h.label];
              return (
                <div key={i} style={{ padding: "12px 20px", borderBottom: `1px solid ${colors.hairline2}`, display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, fontFamily: mono, width: 56, flexShrink: 0 }}>{h.date}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: colors.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.channel}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 6, whiteSpace: "nowrap", flexShrink: 0, background: st.bg, color: st.fg }}>{h.label}</span>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}
