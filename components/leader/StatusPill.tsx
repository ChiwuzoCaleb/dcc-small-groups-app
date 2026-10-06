import { colors } from "@/lib/tokens";
import type { ApprovalStatus } from "@/lib/api/types";

const STATUS_STYLE: Record<ApprovalStatus, { label: string; bg: string; fg: string }> = {
  APPROVED: { label: "Approved", bg: colors.greenSoft, fg: colors.green },
  PENDING: { label: "Pending", bg: colors.amberSoft, fg: colors.amber },
  REJECTED: { label: "Sent back", bg: colors.redSoft, fg: colors.red },
  DELETED: { label: "Deleted", bg: colors.chipGrey, fg: colors.muted },
};

/** "WHATSAPP" -> "WhatsApp", "WEB" -> "Web"; empty when the API sent no source. */
export function formatSource(source?: string | null): string {
  const v = source?.trim();
  if (!v) return "";
  if (v.toUpperCase() === "WHATSAPP") return "WhatsApp";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}

/** Appends the source to a status label, e.g. "Approved.WhatsApp"; unchanged when there is no source. */
export function withSource(label: string, source?: string | null): string {
  const src = formatSource(source);
  return src ? `${label}.${src}` : label;
}

export function StatusPill({ status, source }: { status: ApprovalStatus; source?: string | null }) {
  const t = STATUS_STYLE[status];
  const label = status === "DELETED" ? t.label : withSource(t.label, source);
  return (
    <span
      style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: t.bg, color: t.fg }}
    >
      {label}
    </span>
  );
}
