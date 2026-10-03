"use client";

import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { SundayCalendar } from "@/components/leader/SundayCalendar";
import { ReportWizard } from "@/components/leader/ReportWizard";
import { useMyReports } from "@/hooks/api/reports";
import { useAuth } from "@/hooks/useAuth";
import { cellFrom } from "@/components/coordinator/kit";
import { mostRecentSunday, formatServiceDate } from "@/lib/dates";
import { colors } from "@/lib/tokens";

export default function ReportPage() {
  const { user } = useAuth();
  const latestSunday = useMemo(() => mostRecentSunday(new Date()).toISOString().slice(0, 10), []);
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  const mine = useMyReports();

  const { reported, resubmittable } = useMemo(() => {
    const done = new Set<string>();
    const redo = new Set<string>();
    for (const r of mine.data ?? []) {
      if (!r.service_date) continue;
      done.add(r.service_date);
      if (r.approval_status === "REJECTED") redo.add(r.service_date);
    }
    return { reported: done, resubmittable: redo };
  }, [mine.data]);

  const existing = useMemo(
    () => serviceDate ? (mine.data ?? []).find((r) => r.service_date === serviceDate) ?? null : null,
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
      <PageHeader eyebrow={cellLabel ? `Sunday report for ${cellLabel}` : "Sunday report"} title={serviceDate ? `For ${formatServiceDate(new Date(serviceDate))}` : "Choose a Sunday"} sub={serviceDate ?? "Select the Sunday you are reporting for"} />
      {mine.isLoading ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.muted }}>Loading your reports…</div>
      ) : mine.isError ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.red }}>
          Could not load your reports: {mine.error.message}
        </div>
      ) : !serviceDate ? (
        <div className="dcc-page" style={{ padding: 28 }}>
          <Card style={{ padding: 24, display: "flex", flexDirection: "column", gap: 8 }}>
            <SundayCalendar
              latestSunday={latestSunday}
              reported={reported}
              resubmittable={resubmittable}
              selected={serviceDate}
              onSelect={setServiceDate}
            />
          </Card>
        </div>
      ) : (
        <>
          <div className="dcc-page" style={{ padding: "0 28px 12px" }}>
            <Button type="button" variant="outline" onClick={() => setServiceDate(null)}>Change date</Button>
          </div>
          <ReportWizard key={serviceDate} serviceDate={serviceDate} existing={existing} />
        </>
      )}
    </>
  );
}
