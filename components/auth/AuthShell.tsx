"use client";

import { ReactNode } from "react";
import Image from "next/image";
import { colors } from "@/lib/tokens";

export function AuthShell({
  subtitle,
  roleLabel,
  headline,
  blurb,
  rightPane,
  bottomLeft,
}: {
  subtitle: string;
  roleLabel: string;
  headline: string;
  blurb: string;
  rightPane: ReactNode;
  bottomLeft?: ReactNode;
}) {
  return (
    <div className="dcc-auth-outer" style={{ minHeight: "100vh", background: colors.ink2, display: "flex", justifyContent: "center", padding: "40px 20px" }}>
      <div
        className="dcc-auth-card"
        style={{
          width: "100%",
          maxWidth: 1180,
          borderRadius: 14,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))",
          minHeight: 780,
          boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)",
        }}
      >
        <div className="dcc-auth-pane dcc-auth-brand" style={{ background: colors.ink2, padding: "56px 52px", display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
            <Image src="/assets/daystar-main-logo.png" alt="Daystar" width={270} height={72} unoptimized style={{ height: 32, width: "auto" }} />
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Small Groups</div>
              <div style={{ fontSize: 10.5, color: colors.faint, letterSpacing: "0.06em", textTransform: "uppercase" }}>{subtitle}</div>
            </div>
          </div>
          <div className="dcc-auth-brand-text" style={{ maxWidth: 400 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: colors.red, marginBottom: 14 }}>{roleLabel}</div>
            <div className="dcc-auth-headline" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.18, marginBottom: 16 }}>{headline}</div>
            <div className="dcc-auth-blurb" style={{ fontSize: 14.5, lineHeight: 1.65, color: "#9AA3AE" }}>{blurb}</div>
          </div>
          <div className="dcc-auth-bottom">{bottomLeft}</div>
        </div>
        <div className="dcc-auth-pane" style={{ background: "#fff", padding: "56px 52px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {rightPane}
        </div>
      </div>
    </div>
  );
}
