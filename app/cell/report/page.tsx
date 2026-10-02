"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/ui";
import { ReportWizard } from "@/components/leader/ReportWizard";
import { useMyReports } from "@/hooks/api/reports";
import { useAuth } from "@/hooks/useAuth";
import { cellFrom } from "@/components/coordinator/kit";
import { mostRecentSunday, formatServiceDate } from "@/lib/dates";
import { colors } from "@/lib/tokens";

export default function ReportPage() {
  const { user } = useAuth();
  const serviceDate = useMemo(() => mostRecentSunday(new Date()).toISOString().slice(0, 10), []);
  const mine = useMyReports();

  const existing = useMemo(
    () => (mine.data ?? []).find((r) => r.service_date === serviceDate) ?? null,
    [mine.data, serviceDate],
  );
  const cell = useMemo(() => {
    const fromUser = cellFrom(user);
    if (fromUser.code) return fromUser;
    for (const r of mine.data ?? []) {
      if (r.cell && typeof r.cell === "object" && r.cell.code) return { ...fromUser, code: r.cell.code };
    }
    return fromUser;
  }, [user, mine.data]);
  const cellLabel = cell.code ?? cell.name;
  return (
    <>
      <PageHeader eyebrow={cellLabel ? `Sunday report for ${cellLabel}` : "Sunday report"} title={`For ${formatServiceDate(new Date(serviceDate))}`} sub={serviceDate} />
      {mine.isLoading ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.muted }}>Loading this week&apos;s report…</div>
      ) : mine.isError ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.red }}>
          Could not load your reports: {mine.error.message}
        </div>
      ) : (
        <ReportWizard serviceDate={serviceDate} existing={existing} />
      )}
    </>
  );
}
