"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import {
  IconHeartHandshake,
  IconMessageCircle,
  IconPlant2,
  IconUsers,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import { colors, mono } from "@/lib/tokens";
import { Card, Button, TextArea } from "@/components/ui";
import {
  REPORT_STEPS,
  ALL_FIGURE_KEYS,
  type FigureKey,
} from "@/lib/reports/fields";
import { formatServiceDate } from "@/lib/dates";
import { useCreateReport, useUpdateReport } from "@/hooks/api/reports";
import { useApprovalSettings } from "@/hooks/api/approvals";
import { ApiError } from "@/lib/api/errors";
import { notify } from "@/lib/toast";
import type {
  CreateReportInput,
  SundayReport,
  SundayReportFigures,
} from "@/lib/api/types";
import { reportCommentText } from "@/lib/api/reportComments";

/** Whole/half-hour phrasing for the fallback-approval window ("36 hours", "1.5 hours"). */
function formatHours(seconds: number): string {
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * The API has one `comment` field: when an approver sends a report back, their
 * note replaces the leader's own comment. The leader's original is therefore
 * remembered on this device (by report id) so it can prefill a resubmission.
 */
const commentStoreKey = (reportId: string) => `dcc:report-comment:${reportId}`;

function readStoredComment(reportId?: string): string {
  if (!reportId || typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(commentStoreKey(reportId)) ?? "";
  } catch {
    return "";
  }
}

function storeComment(reportId: string | undefined, value: string) {
  if (!reportId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(commentStoreKey(reportId), value);
  } catch {
    /* storage unavailable — the comment just won't be prefilled */
  }
}

type Figures = Partial<Record<FigureKey, number | null>>;

const STEP_ICONS: Record<string, Icon> = {
  Membership: IconUsers,
  Maturity: IconPlant2,
  Ministry: IconHeartHandshake,
  Mission: IconWorld,
  Comments: IconMessageCircle,
};

/**
 * Every +/- field starts at 0.
 *
 * 0 is a valid answer.
 * null is only used when an existing API record does not contain a value.
 */
function figuresFrom(report: SundayReport | null): Figures {
  const out: Figures = Object.fromEntries(
    ALL_FIGURE_KEYS.map((key) => [key, 0]),
  );

  if (!report) return out;

  for (const key of ALL_FIGURE_KEYS) {
    const v = report[key];
    out[key] = typeof v === "number" ? v : 0;
  }

  return out;
}

/**
 * Automatically maps each figure field to the wizard step containing it.
 */
const FIELD_STEP_INDEX: Partial<Record<FigureKey, number>> =
  Object.fromEntries(
    REPORT_STEPS.flatMap((step, stepIndex) =>
      step.fields.map((field) => [field.key, stepIndex]),
    ),
  ) as Partial<Record<FigureKey, number>>;

/**
 * Format a number for display as comma-delimited thousands.
 *
 * 0       -> "0"
 * 1000    -> "1,000"
 * 1500000 -> "1,500,000"
 */
function formatNumber(value: number | null | undefined): string {
  if (value == null) return "";
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Convert a formatted numeric string back into a number.
 *
 * "1,500,000" -> 1500000
 * "abc"       -> null
 */
function parseNumber(raw: string): number | null {
  const digits = raw.replace(/[^0-9]/g, "");

  if (!digits) return null;

  const value = Number(digits);

  return Number.isFinite(value) ? value : null;
}

/** Backend rule: total_offering must be at least NGN 100 when the meeting held. */
const MIN_OFFERING_NGN = 100;
const OFFERING_MIN_MESSAGE = `Total Offering must be at least NGN ${MIN_OFFERING_NGN}.`;

export function ReportWizard({
  serviceDate,
  existing,
  cellId,
  returnTo = "/cell",
}: {
  serviceDate: string;
  existing: SundayReport | null;
  /** Set when a leader submits on behalf of a cell; the API records who did it. */
  cellId?: string;
  returnTo?: string;
}) {
  const router = useRouter();

  const status = existing?.approval_status ?? null;
  const locked = status === "PENDING" || status === "APPROVED";
  const isResubmit = status === "REJECTED";

  const [step, setStep] = useState(0);

  const [values, setValues] = useState<Figures>(() =>
    figuresFrom(existing),
  );

  /**
   * meeting_held is a BOOLEAN.
   *
   * true  = meeting held
   * false = meeting did not hold
   */
  const [meetingHeld, setMeetingHeld] = useState<boolean>(
    existing?.meeting_held ?? true,
  );

  // On a rejected report, `existing.comment` is the approver's note, not the leader's.
  const [comment, setComment] = useState<string>(
    isResubmit ? readStoredComment(existing?.id) : (reportCommentText(existing)),
  );

  /**
   * Individual field validation errors.
   *
   * Example:
   * {
   *   members_present: "Members Present must be greater than 0."
   * }
   */
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<FigureKey, string>>
  >({});

  const createReport = useCreateReport();
  const updateReport = useUpdateReport(existing?.id ?? "");

  const pending = createReport.isPending || updateReport.isPending;

  const approvalSettings = useApprovalSettings();

  const escalationHours =
    !approvalSettings.isError &&
    approvalSettings.data?.approval_interval != null
      ? formatHours(approvalSettings.data.approval_interval)
      : null;

  const runningTotal = useMemo(
    () =>
      ALL_FIGURE_KEYS.reduce(
        (sum, k) => sum + (values[k] ?? 0),
        0,
      ),
    [values],
  );

  const answeredCount = useMemo(
    () =>
      ALL_FIGURE_KEYS.filter((k) => values[k] != null).length,
    [values],
  );

  const commentRequired = !meetingHeld;

  const submitDisabled =
    pending || (commentRequired && !comment.trim());

  function showToast(message: string) {
    notify.error(message);
  }

  /**
   * Update a normal +/- figure.
   *
   * Empty string -> null
   * "0"          -> 0
   * "25"         -> 25
   *
   * Any answered value, including 0, clears its validation error.
   */
  function setFigure(key: FigureKey, raw: string) {
    const digits = raw.replace(/[^0-9]/g, "");

    const nextValue =
      digits === "" ? null : Number(digits);

    setValues((current) => ({
      ...current,
      [key]: nextValue,
    }));

    const isValidValue =
      key === "members_present"
        ? nextValue != null && nextValue > 0
        : nextValue != null;

    if (isValidValue) {
      setFieldErrors((current) => {
        if (!current[key]) return current;

        const next = { ...current };
        delete next[key];

        return next;
      });
    }
  }

  /**
   * Offering is a numeric input, separate from the +/- fields.
   *
   * The UI displays commas, but the stored value remains a number.
   */
  function setOffering(raw: string) {
    const nextValue = parseNumber(raw);

    setValues((current) => ({
      ...current,
      total_offering: nextValue,
    }));

    // Live feedback so the minimum is visible before the leader submits.
    setFieldErrors((current) => {
      const tooLow = nextValue != null && nextValue < MIN_OFFERING_NGN;
      if (tooLow) return { ...current, total_offering: OFFERING_MIN_MESSAGE };
      if (!current.total_offering) return current;

      const next = { ...current };
      delete next.total_offering;

      return next;
    });
  }

  /**
   * Find the first field that fails client-side validation.
   *
   * Most numeric fields accept 0, but Members Present and Total Offering
   * have stricter minimums.
   *
   * The special numeric rules are:
   * - Members Present must be greater than 0.
   * - Total Offering must be at least NGN 100.
   *
   * When a step index is provided, only validate that step's fields.
   */
  function validateRequiredFields(stepIndex?: number): FigureKey | null {
    if (!meetingHeld) {
      setFieldErrors({});
      return null;
    }

    const errors: Partial<Record<FigureKey, string>> = {};

    /**
     * Members Present must be greater than zero whenever
     * the meeting held.
     */
    const membersPresent = values.members_present;

    if (
      (stepIndex == null || stepIndex === 0) &&
      (membersPresent == null || membersPresent <= 0)
    ) {
      errors.members_present =
        "Members Present must be greater than 0.";
    }

    /**
     * Backend rule: total_offering must be >= 100 when currency is NGN
     * and the meeting held.
     */
    const offering = values.total_offering;

    if (
      (stepIndex == null || stepIndex === 1) &&
      (offering == null || offering < MIN_OFFERING_NGN)
    ) {
      errors.total_offering = OFFERING_MIN_MESSAGE;
    }

    setFieldErrors(errors);

    if (errors.members_present) return "members_present";
    if (errors.total_offering) return "total_offering";
    return null;
  }

  /**
   * Navigate to the step containing the failed field,
   * scroll it into view and focus its input.
   */
  function goToField(fieldKey: FigureKey) {
    const targetStep = FIELD_STEP_INDEX[fieldKey];

    if (targetStep == null) return;

    setStep(targetStep);

    window.setTimeout(() => {
      const fieldElement = document.getElementById(
        `field-${fieldKey}`,
      );

      fieldElement?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      const inputElement = document.getElementById(
        `input-${fieldKey}`,
      ) as HTMLInputElement | null;

      inputElement?.focus();
    }, 50);
  }

  function goToStep(targetStep: number) {
    if (targetStep > step && meetingHeld) {
      for (let stepIndex = 0; stepIndex < targetStep; stepIndex += 1) {
        const invalidField = validateRequiredFields(stepIndex);

        if (!invalidField) continue;

        const fieldLabel =
          REPORT_STEPS.flatMap((reportStep) => reportStep.fields).find(
            (field) => field.key === invalidField,
          )?.label ?? invalidField;

        showToast(`Please check "${fieldLabel}".`);
        goToField(invalidField);
        return;
      }
    }

    setStep(targetStep);
  }

  /**
   * Extract a useful backend error message.
   *
   * Supports:
   * - normal ApiError.message strings
   * - JSON strings
   * - common Django/DRF-style field validation responses
   */
  function getBackendErrorMessage(err: unknown): string {
    if (!(err instanceof ApiError)) {
      return "Could not submit the report. Please try again.";
    }

    const rawMessage = err.message;

    if (!rawMessage) {
      return "Could not submit the report. Please try again.";
    }

    /**
     * If the API error is already a clean human-readable string,
     * use it directly.
     */
    if (
      !rawMessage.trim().startsWith("{") &&
      !rawMessage.trim().startsWith("[")
    ) {
      return rawMessage;
    }

    /**
     * Some API clients serialize backend validation errors into
     * the ApiError message.
     */
    try {
      const parsed = JSON.parse(rawMessage);

      if (typeof parsed === "string") {
        return parsed;
      }

      /**
       * Django REST Framework-style:
       *
       * {
       *   "members_present": ["This field is required."]
       * }
       */
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        const messages: string[] = [];

        for (const [field, value] of Object.entries(parsed)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (typeof item === "string") {
                messages.push(`${field}: ${item}`);
              }
            }
          } else if (typeof value === "string") {
            messages.push(`${field}: ${value}`);
          }
        }

        if (messages.length > 0) {
          return messages.join(" ");
        }

        if (
          typeof parsed.detail === "string"
        ) {
          return parsed.detail;
        }

        if (
          typeof parsed.message === "string"
        ) {
          return parsed.message;
        }
      }

      return rawMessage;
    } catch {
      return rawMessage;
    }
  }

  /**
   * Attempt to identify a backend field-validation error and
   * highlight/navigate to that field.
   *
   * This is intentionally best-effort because backend error
   * formats can vary.
   */
  function handleBackendValidationError(err: unknown) {
    if (!(err instanceof ApiError)) return;

    const rawMessage = err.message ?? "";

    for (const field of ALL_FIGURE_KEYS) {
      const fieldLabel =
        REPORT_STEPS.flatMap((s) => s.fields).find(
          (item) => item.key === field,
        )?.label ?? field;

      const normalizedMessage =
        rawMessage.toLowerCase();

      if (
        normalizedMessage.includes(field.toLowerCase()) ||
        normalizedMessage.includes(fieldLabel.toLowerCase())
      ) {
        setFieldErrors({
          [field]: rawMessage,
        });

        goToField(field);

        return;
      }
    }
  }

  function buildPayload(): Partial<SundayReportFigures> & {
    service_date: string;
  } {
    const payload: Partial<SundayReportFigures> & {
      service_date: string;
    } = {
      service_date: serviceDate,
      meeting_held: meetingHeld,
      currency: "NGN",
    };

    /**
     * Figures only apply when the meeting actually held.
     */
    if (meetingHeld) {
      for (const key of ALL_FIGURE_KEYS) {
        if (values[key] != null) {
          payload[key] = values[key];
        }
      }
    }

    if (comment.trim()) {
      payload.comment = comment.trim();
    }

    return payload;
  }

  async function submit() {
    /**
     * If the meeting did not hold, the comment is required.
     */
    if (commentRequired && !comment.trim()) {
      showToast(
        "Add a comment explaining why the meeting didn't hold.",
      );
      return;
    }

    /**
     * Validate report figures when the meeting held.
     */
    if (meetingHeld) {
      const invalidField = validateRequiredFields();

      if (invalidField) {
        const fieldLabel =
          REPORT_STEPS.flatMap((s) => s.fields).find(
            (field) => field.key === invalidField,
          )?.label ?? invalidField;

        showToast(
          `Please check "${fieldLabel}".`,
        );

        goToField(invalidField);

        return;
      }
    }

    const payload = buildPayload();

    try {
      if (isResubmit && existing) {
        await updateReport.mutateAsync(payload);
        storeComment(existing.id, comment.trim());
      } else {
        if (!cellId) {
          notify.error(
            "Could not identify your cell for this report. Refresh the page and try again.",
          );
          return;
        }

        const createPayload: CreateReportInput = { ...payload, cell: cellId };
        const created = await createReport.mutateAsync(createPayload);
        storeComment(created?.id, comment.trim());
      }

      notify.success(
        isResubmit ? "Report resubmitted successfully" : "Report submitted successfully",
      );
      router.push(returnTo);
    } catch (err) {
      handleBackendValidationError(err);

      notify.error(getBackendErrorMessage(err));
    }
  }

  const current = REPORT_STEPS[step];
  const isCommentsStep = current.category === "Comments";

  return (
    <div
      className="dcc-page"
      style={{
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <Card style={{ padding: 16 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            Did the cell meeting hold this Sunday?
          </span>

          <span
            style={{
              display: "flex",
              gap: 6,
            }}
          >
            {[
              ["Yes", true],
              ["No", false],
            ].map(([label, value]) => (
              <button
                key={String(label)}
                type="button"
                disabled={locked}
                onClick={() =>
                  setMeetingHeld(value as boolean)
                }
                style={{
                  padding: "8px 14px",
                  minHeight: 40,
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: locked
                    ? "default"
                    : "pointer",
                  border: `1.5px solid ${
                    meetingHeld === value
                      ? colors.red
                      : colors.borderStrong
                  }`,
                  background:
                    meetingHeld === value
                      ? colors.redSoft
                      : colors.fieldBg,
                  color:
                    meetingHeld === value
                      ? colors.red
                      : colors.muted,
                }}
              >
                {label}
              </button>
            ))}
          </span>
        </label>

        {!meetingHeld && (
          <div
            style={{
              fontSize: 12,
              color: colors.muted,
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            No figures needed — just tell your Section
            Leader what happened.
          </div>
        )}
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: meetingHeld
            ? "200px 1fr 260px"
            : "1fr 260px",
          gap: 24,
          alignItems: "flex-start",
        }}
        className="dcc-wizard"
      >
        {meetingHeld && (
          <div
            className="dcc-steps"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {REPORT_STEPS.map((item, index) => {
              const StepIcon = STEP_ICONS[item.category];
              return (
              <button
                key={item.category}
                type="button"
                className={index === step ? "dcc-step-active" : undefined}
                aria-label={item.category}
                aria-current={index === step ? "step" : undefined}
                onClick={() => goToStep(index)}
                style={{
                  textAlign: "left",
                  border: "none",
                  background:
                    index === step
                      ? colors.redSoft
                      : "transparent",
                  color:
                    index === step
                      ? colors.red
                      : colors.muted,
                  padding: "10px 12px",
                  minHeight: 44,
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {StepIcon && (
                  <span className="dcc-step-icon">
                    <StepIcon size={22} stroke={1.8} />
                  </span>
                )}
                <span className="dcc-step-label">
                  {index + 1}. {item.category}
                </span>
              </button>
              );
            })}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          {locked && (
            <Card
              style={{
                padding: 16,
                marginBottom: 16,
                background: colors.panel,
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  color: colors.muted,
                }}
              >
                {status === "APPROVED"
                  ? "This report is approved and locked."
                  : "This report is submitted and awaiting review."}
              </div>
            </Card>
          )}

          {isResubmit && (
            <Card
              style={{
                padding: 16,
                marginBottom: 16,
                background: colors.redSoft,
                borderColor: colors.redSoftBorder,
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: colors.red,
                  marginBottom: 4,
                }}
              >
                SENT BACK
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: colors.ink,
                }}
              >
                {reportCommentText(existing) ||
                  "Your approver sent this back for correction. Update the figures and resubmit."}
              </div>
            </Card>
          )}

          {meetingHeld ? (
            <>
              <div
                style={{
                  height: 4,
                  background: colors.hairline,
                  borderRadius: 4,
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${
                      ((step + 1) /
                        REPORT_STEPS.length) *
                      100
                    }%`,
                    background: colors.red,
                    borderRadius: 4,
                    transition:
                      "width 200ms",
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                {current.category}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: colors.muted,
                  marginBottom: 20,
                }}
              >
                {current.hint}
              </div>

              <Card style={{ padding: 20 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  {isCommentsStep && (
                    <label
                      style={{ display: "block" }}
                    >
                      <span
                        style={{
                          display: "block",
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.muted,
                          marginBottom: 6,
                        }}
                      >
                        Comments
                      </span>

                      <TextArea
                        value={comment}
                        onChange={setComment}
                        placeholder="Testimonies, and anything else worth recording…"
                        disabled={locked}
                      />
                    </label>
                  )}

                  {current.fields.map(
                    (field, index) => {
                      const showGroup =
                        field.group &&
                        current.fields[index - 1]
                          ?.group !== field.group;

                      const value =
                        values[field.key];

                      const fieldError =
                        fieldErrors[field.key];

                      const isOffering =
                        field.key ===
                        "total_offering";

                      return (
                        <div
                          key={field.key}
                          id={`field-${field.key}`}
                        >
                          {showGroup && (
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: colors.faint,
                                textTransform:
                                  "uppercase",
                                letterSpacing:
                                  "0.04em",
                                margin:
                                  "6px 0",
                              }}
                            >
                              {field.group}
                            </div>
                          )}

                          <label
                            style={{
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "space-between",
                              gap: 12,
                              minHeight: 44,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13.5,
                              }}
                            >
                              {field.label}
                            </span>

                            {isOffering ? (
                              /*
                               * Offering is deliberately NOT a
                               * +/- field.
                               *
                               * It accepts only numbers and displays
                               * comma-delimited thousands.
                               */
                              <input
                                id={`input-${field.key}`}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                disabled={locked}
                                value={formatNumber(
                                  value,
                                )}
                                onChange={(event) =>
                                  setOffering(
                                    event.target
                                      .value,
                                  )
                                }
                                aria-label={
                                  field.label
                                }
                                aria-invalid={
                                  fieldError
                                    ? "true"
                                    : "false"
                                }
                                aria-describedby={
                                  fieldError
                                    ? `error-${field.key}`
                                    : undefined
                                }
                                placeholder="0"
                                style={{
                                  width: 150,
                                  minHeight: 40,
                                  textAlign: "right",
                                  border: `1.5px solid ${
                                    fieldError
                                      ? colors.red
                                      : colors.borderStrong
                                  }`,
                                  borderRadius: 10,
                                  padding:
                                    "7px 10px",
                                  fontSize: 15,
                                  fontFamily: mono,
                                  outline: "none",
                                  background:
                                    fieldError
                                      ? colors.redSoft
                                      : locked
                                        ? colors.panel
                                        : colors.fieldBg,
                                }}
                              />
                            ) : (
                              <span
                                role="group"
                                aria-label={
                                  field.label
                                }
                                style={{
                                  display: "flex",
                                  alignItems:
                                    "center",
                                  gap: 6,
                                }}
                              >
                                <button
                                  type="button"
                                  aria-label={`Decrease ${field.label}`}
                                  disabled={locked}
                                  onClick={() =>
                                    setFigure(
                                      field.key,
                                      String(
                                        Math.max(
                                          0,
                                          (value ??
                                            0) - 1,
                                        ),
                                      ),
                                    )
                                  }
                                  style={stepperButtonStyle(
                                    locked,
                                  )}
                                >
                                  <Minus
                                    size={15}
                                  />
                                </button>

                                <input
                                  id={`input-${field.key}`}
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  disabled={locked}
                                  value={
                                    value == null
                                      ? "0"
                                      : String(
                                          value,
                                        )
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    setFigure(
                                      field.key,
                                      event.target
                                        .value,
                                    )
                                  }
                                  aria-label={
                                    field.label
                                  }
                                  aria-invalid={
                                    fieldError
                                      ? "true"
                                      : "false"
                                  }
                                  aria-describedby={
                                    fieldError
                                      ? `error-${field.key}`
                                      : undefined
                                  }
                                  style={{
                                    width: 56,
                                    minHeight: 40,
                                    textAlign:
                                      "center",
                                    border: `1.5px solid ${
                                      fieldError
                                        ? colors.red
                                        : colors.borderStrong
                                    }`,
                                    borderRadius: 10,
                                    padding:
                                      "7px 8px",
                                    fontSize: 15,
                                    fontFamily:
                                      mono,
                                    outline: "none",
                                    background:
                                      fieldError
                                        ? colors.redSoft
                                        : locked
                                          ? colors.panel
                                          : colors.fieldBg,
                                  }}
                                />

                                <button
                                  type="button"
                                  aria-label={`Increase ${field.label}`}
                                  disabled={locked}
                                  onClick={() =>
                                    setFigure(
                                      field.key,
                                      String(
                                        (value ??
                                          0) + 1,
                                      ),
                                    )
                                  }
                                  style={stepperButtonStyle(
                                    locked,
                                  )}
                                >
                                  <Plus
                                    size={15}
                                  />
                                </button>
                              </span>
                            )}
                          </label>

                          {fieldError && (
                            <div
                              id={`error-${field.key}`}
                              role="alert"
                              style={{
                                marginTop: 3,
                                marginBottom: 6,
                                fontSize: 11.5,
                                color: colors.red,
                              }}
                            >
                              {fieldError}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </Card>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  marginTop: 20,
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() =>
                    setStep((value) =>
                      Math.max(0, value - 1),
                    )
                  }
                  disabled={step === 0}
                >
                  Back
                </Button>

                {step <
                REPORT_STEPS.length - 1 ? (
                  <Button
                    variant="dark"
                    onClick={() => goToStep(step + 1)}
                  >
                    Next
                  </Button>
                ) : (
                  !locked && (
                    <Button
                      variant="primary"
                      onClick={submit}
                      disabled={submitDisabled}
                    >
                      {pending
                        ? "Submitting…"
                        : isResubmit
                          ? "Resubmit report"
                          : "Submit report"}
                    </Button>
                  )
                )}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                Comments
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: colors.muted,
                  marginBottom: 20,
                }}
              >
                Let your Section Leader know why
                the meeting did not hold.
              </div>

              <Card style={{ padding: 20 }}>
                <label
                  style={{ display: "block" }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.muted,
                      marginBottom: 6,
                    }}
                  >
                    Comments{" "}
                    <span
                      style={{ color: colors.red }}
                    >
                      *
                    </span>
                  </span>

                  <TextArea
                    value={comment}
                    onChange={setComment}
                    placeholder="What happened this Sunday? (required)"
                    disabled={locked}
                    minHeight={180}
                  />
                </label>
              </Card>

              {!locked && (
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    marginTop: 20,
                  }}
                >
                  <Button
                    variant="primary"
                    onClick={submit}
                    disabled={submitDisabled}
                  >
                    {pending
                      ? "Submitting…"
                      : isResubmit
                        ? "Resubmit report"
                        : "Submit report"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <Card
          style={{
            padding: 18,
            position: "sticky",
            top: 20,
          }}
        >
          {meetingHeld && (
            <>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: colors.muted,
                  textTransform:
                    "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 10,
                }}
              >
                Running total
              </div>

              {/* <div
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  fontFamily: mono,
                  marginBottom: 4,
                }}
              >
                {runningTotal}
              </div>
 */}
              <div
                style={{
                  fontSize: 12,
                  color: colors.faint,
                  marginBottom: 16,
                }}
              >
                {answeredCount} of{" "}
                {ALL_FIGURE_KEYS.length}{" "}
                figures answered
              </div>
            </>
          )}

          <div
            style={{
              fontSize: 11.5,
              color: colors.faint2,
            }}
          >
            For{" "}
            {formatServiceDate(
              new Date(serviceDate),
            )}{" "}
            · nothing is saved until you submit
          </div>

          {escalationHours && (
            <div
              style={{
                fontSize: 11.5,
                color: colors.faint2,
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              After you submit, your Section
              Leader has {escalationHours} to
              review it before an Area or Zonal
              Coordinator can step in.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function stepperButtonStyle(
  disabled: boolean,
): React.CSSProperties {
  return {
    display: "grid",
    placeItems: "center",
    width: 28,
    height: 28,
    padding: 0,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 7,
    background: "#fff",
    color: disabled
      ? colors.faint2
      : colors.ink,
    cursor: disabled
      ? "default"
      : "pointer",
  };
}