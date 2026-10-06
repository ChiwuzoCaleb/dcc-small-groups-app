"use client";

import { useState } from "react";
import { Button, TextArea } from "@/components/ui";
import { useApproveReport, useRejectReport } from "@/hooks/api/reports";
import { notify } from "@/lib/toast";
import { colors } from "@/lib/tokens";

/** Approve / Send back controls for one report. Shared by the approvals queue and the report dialog. */
export function ReportDecisionBar({
  reportId,
  onDone,
  allowSendBack = true,
}: {
  reportId: string;
  onDone?: () => void;
  /** False for reports submitted over a week late, which can only be approved. */
  allowSendBack?: boolean;
}) {
  const approve = useApproveReport();
  const reject = useRejectReport();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [comment, setComment] = useState("");
  const busy = approve.isPending || reject.isPending;

  async function onApprove() {
    try {
      await approve.mutateAsync({ id: reportId, comment: comment.trim() || undefined });
      notify.success("Report approved");
      onDone?.();
    } catch (err) {
      notify.error(err, "Could not approve the report");
    }
  }

  async function onReject() {
    if (!comment.trim()) {
      notify.error("Add a note so the Cell Leader knows what to fix");
      return;
    }
    try {
      await reject.mutateAsync({ id: reportId, comment: comment.trim() });
      notify.success("Report sent back");
      setMode("idle");
      setComment("");
      onDone?.();
    } catch (err) {
      notify.error(err, "Could not send the report back");
    }
  }

  return (
    <div style={{ borderTop: `1px solid ${colors.hairline}`, paddingTop: 16 }}>
      {mode === "reject" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <TextArea
            value={comment}
            onChange={setComment}
            placeholder="What does the Cell Leader need to correct?"
            minHeight={90}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={onReject} disabled={busy}>
              {reject.isPending ? "Sending…" : "Send back"}
            </Button>
            <Button variant="secondary" onClick={() => setMode("idle")} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="primary" onClick={onApprove} disabled={busy}>
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
          {allowSendBack ? (
            <Button variant="danger-outline" onClick={() => setMode("reject")} disabled={busy}>
              Send back
            </Button>
          ) : (
            <span style={{ fontSize: 12, color: colors.faint }}>
              Submitted over a week after the due date, so it can't be sent back.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
