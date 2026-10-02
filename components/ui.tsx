"use client";

import { CSSProperties, ReactNode, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/tokens";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  radius = 12,
  padding = "13px 14px",
  fontSize = 14.5,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  radius?: number;
  padding?: string;
  fontSize?: number;
  style?: CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  const input = (
    <input
      value={value}
      type={inputType}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={{
        width: "100%",
        border: `1.5px solid ${focused ? colors.red : colors.borderStrong}`,
        borderRadius: radius,
        padding,
        paddingRight: isPassword ? 44 : undefined,
        fontSize,
        outline: "none",
        background: focused ? "#fff" : colors.fieldBg,
        fontFamily: mono ? "var(--font-plex-mono), monospace" : "inherit",
        ...style,
      }}
    />
  );

  if (!isPassword) return input;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {input}
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-label={revealed ? "Hide password" : "Show password"}
        aria-pressed={revealed}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 6,
          width: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: colors.faint2,
          padding: 0,
        }}
      >
        <EyeIcon off={revealed} />
      </button>
    </div>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  minHeight = 150,
  fontSize = 14,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  fontSize?: number;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%",
        minHeight,
        border: `1.5px solid ${focused ? colors.red : colors.borderStrong}`,
        borderRadius: 12,
        padding: 14,
        fontSize,
        lineHeight: 1.55,
        outline: "none",
        resize: "vertical",
        background: disabled ? colors.panel : focused ? "#fff" : colors.fieldBg,
        cursor: disabled ? "default" : "text",
      }}
    />
  );
}

type BtnVariant = "primary" | "secondary" | "dark" | "danger-outline" | "ghost";

export function Button({
  children,
  onClick,
  variant = "secondary",
  fullWidth = false,
  style,
  padding = "13px 20px",
  fontSize = 14,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  fullWidth?: boolean;
  style?: CSSProperties;
  padding?: string;
  fontSize?: number;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);

  const base: CSSProperties = {
    cursor: disabled ? "default" : "pointer",
    fontWeight: 600,
    padding,
    fontSize,
    borderRadius: 12,
    letterSpacing: "-0.01em",
    width: fullWidth ? "100%" : undefined,
    opacity: disabled ? 0.6 : 1,
  };

  const variants: Record<BtnVariant, CSSProperties> = {
    primary: {
      border: "none",
      background: hover ? colors.redDark : colors.red,
      color: "#fff",
    },
    dark: {
      border: "none",
      background: colors.ink,
      color: "#fff",
    },
    secondary: {
      border: `1.5px solid ${hover ? colors.ink : colors.borderStrong}`,
      background: "#fff",
      color: colors.ink,
    },
    "danger-outline": {
      border: `1.5px solid ${hover ? colors.red : colors.borderStrong}`,
      background: "#fff",
      color: hover ? colors.red : colors.ink,
    },
    ghost: {
      border: "none",
      background: "transparent",
      color: colors.faint,
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

const BTN_VARIANT_STYLE: Record<BtnVariant, CSSProperties> = {
  primary: { border: "none", background: colors.red, color: "#fff" },
  dark: { border: "none", background: colors.ink, color: "#fff" },
  secondary: { border: `1.5px solid ${colors.borderStrong}`, background: "#fff", color: colors.ink },
  "danger-outline": { border: `1.5px solid ${colors.borderStrong}`, background: "#fff", color: colors.ink },
  ghost: { border: "none", background: "transparent", color: colors.faint },
};

/** Same look as {@link Button}, but a real anchor — safe to use where a `<button>` would nest inside a `<Link>`. */
export function LinkButton({
  children,
  href,
  variant = "secondary",
  fullWidth = false,
  style,
  padding = "13px 20px",
  fontSize = 14,
}: {
  children: ReactNode;
  href: string;
  variant?: BtnVariant;
  fullWidth?: boolean;
  style?: CSSProperties;
  padding?: string;
  fontSize?: number;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        textAlign: "center",
        cursor: "pointer",
        fontWeight: 600,
        padding,
        fontSize,
        borderRadius: 12,
        letterSpacing: "-0.01em",
        width: fullWidth ? "100%" : undefined,
        minHeight: 44,
        boxSizing: "border-box",
        ...BTN_VARIANT_STYLE[variant],
        ...style,
      }}
    >
      {children}
    </Link>
  );
}

export function Chip({
  label,
  active,
  onClick,
  activeBg = colors.ink,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeBg?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? activeBg : colors.borderStrong}`,
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        padding: "8px 12px",
        borderRadius: 9,
        whiteSpace: "nowrap",
        background: active ? activeBg : "#fff",
        color: active ? "#fff" : colors.muted,
      }}
    >
      {label}
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The one header every authenticated page renders as its first element.
 * `position: sticky` (not `fixed`) is deliberate: this sits inside
 * `SidebarInset`'s normal document flow, which — because the whole page
 * scrolls as one document and the sidebar pins itself independently via its
 * own internal `fixed` positioning — is what keeps the header glued to the
 * viewport top on scroll *without* also having to track the sidebar's
 * expanded/collapsed/mobile width to avoid overlapping it. A true `fixed`
 * header would need that width tracked by hand; sticky gets it for free
 * because it never leaves `SidebarInset`'s box in the first place.
 */
export function PageHeader({
  eyebrow,
  title,
  sub,
  right,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className="dcc-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "#fff",
        borderBottom: `1px solid ${colors.border}`,
        padding: "16px 28px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <SidebarTrigger className="-ml-1" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div style={{ fontSize: 11.5, color: colors.faint, marginBottom: 6 }}>{eyebrow}</div>}
            <div className="dcc-title" style={{ fontSize: 25, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.15 }}>{title}</div>
            {sub && <div style={{ fontSize: 13, color: colors.muted, marginTop: 5 }}>{sub}</div>}
          </div>
          {right && <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>{right}</div>}
        </div>
      </div>
    </div>
  );
}
