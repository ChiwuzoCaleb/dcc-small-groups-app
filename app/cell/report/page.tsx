"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/ui";
import { ReportWizard } from "@/components/leader/ReportWizard";
import { useMyReports } from "@/hooks/api/reports";
import { mostRecentSunday, formatServiceDate } from "@/lib/dates";
import { colors } from "@/lib/tokens";

export default function ReportPage() {
  const serviceDate = useMemo(() => mostRecentSunday(new Date()).toISOString().slice(0, 10), []);
  const mine = useMyReports();

  const existing = useMemo(
    () => (mine.data ?? []).find((r) => r.service_date === serviceDate) ?? null,
    [mine.data, serviceDate],
  );
  return (
    <>
      <PageHeader eyebrow="Sunday report" title={`For ${formatServiceDate(new Date(serviceDate))}`} sub={serviceDate} />
      {mine.isLoading ? (
        <div style={{ padding: 28, fontSize: 13, color: colors.muted }}>Loading this week&apos;s report…</div>
      ) : mine.isError ? (
        <div style={{ padding: 28, fontSize: 13, color: colors.red }}>
          Could not load your reports: {mine.error.message}
        </div>
      ) : (
        <ReportWizard serviceDate={serviceDate} existing={existing} />
      )}
    </>
  );
}
