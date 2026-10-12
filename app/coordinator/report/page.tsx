"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ReportWizard } from "@/components/leader/ReportWizard";
import { useRole } from "@/hooks/useRole";
import { useReport } from "@/hooks/api/reports";
import { formatServiceDate } from "@/lib/dates";
import { colors } from "@/lib/tokens";

type Params = { cell?: string; cell_code?: string; name?: string; leader?: string; date?: string; report?: string };

/** A leader above the cell submits (or edits a pending) Sunday report on the cell leader's behalf. */
export default function SubmitOnBehalfPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { cell, cell_code: cellCode, name, leader, date, report: reportId } = use(searchParams);
  const { capabilities } = useRole();
  const editing = useReport(reportId ?? null);
  const validDate = Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));
  const validCell = Boolean(cell && cellCode);
  const valid = validCell && validDate;
  const waitingForReport = Boolean(reportId) && editing.isLoading;

  return (
    <>
      <PageHeader
        eyebrow={leader ? `On behalf of ${leader} for ${name ?? "the cell"}` : `On behalf of ${name ?? "the cell"}`}
        title={valid ? `Sunday report · ${formatServiceDate(new Date(date as string))}` : "Sunday report"}
        sub="This submission is recorded under your name"
      />
      {!valid || capabilities.readOnly ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.red }}>
          {capabilities.readOnly
            ? "Your role cannot submit reports."
            : !validCell
              ? "This cell is missing its cell code. Return to the dashboard and select a cell with a configured code."
              : "Pick a cell from the dashboard to start a report."}{" "}
          <Button asChild variant="outline"><Link href="/coordinator">Back to dashboard</Link></Button>
        </div>
      ) : waitingForReport ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.muted }}>Loading report…</div>
      ) : reportId && !editing.data ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.red }}>
          Could not load this report for editing.{" "}
          <Button asChild variant="outline"><Link href="/coordinator">Back to dashboard</Link></Button>
        </div>
      ) : (
        <ReportWizard
          key={editing.data?.id ?? "new"}
          serviceDate={date as string}
          existing={reportId ? editing.data ?? null : null}
          cellCode={cellCode}
          returnTo="/coordinator"
        />
      )}
    </>
  );
}