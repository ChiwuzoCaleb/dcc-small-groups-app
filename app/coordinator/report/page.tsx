"use client";

import { use } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ReportWizard } from "@/components/leader/ReportWizard";
import { useRole } from "@/hooks/useRole";
import { formatServiceDate } from "@/lib/dates";
import { colors } from "@/lib/tokens";

type Params = { cell?: string; name?: string; leader?: string; date?: string };

/** A leader above the cell submits a Sunday report on the cell leader's behalf. */
export default function SubmitOnBehalfPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { cell, name, leader, date } = use(searchParams);
  const { capabilities } = useRole();
  const valid = Boolean(cell && date && /^\d{4}-\d{2}-\d{2}$/.test(date));

  return (
    <>
      <PageHeader
        eyebrow={leader ? `On behalf of ${leader} for ${name ?? "the cell"}` : `On behalf of ${name ?? "the cell"}`}
        title={valid ? `Sunday report · ${formatServiceDate(new Date(date as string))}` : "Sunday report"}
        sub="This submission is recorded under your name"
      />
      {!valid || capabilities.readOnly ? (
        <div className="dcc-page" style={{ padding: 28, fontSize: 13, color: colors.red }}>
          {capabilities.readOnly ? "Your role cannot submit reports." : "Pick a cell from the dashboard to start a report."}{" "}
          <Button asChild variant="outline"><Link href="/coordinator">Back to dashboard</Link></Button>
        </div>
      ) : (
        <ReportWizard serviceDate={date as string} existing={null} cellId={cell} returnTo="/coordinator" />
      )}
    </>
  );
}