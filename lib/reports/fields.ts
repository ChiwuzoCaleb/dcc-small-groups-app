/**
 * The Sunday-report figures, keyed and named exactly as the DCC API expects
 * them (`SundayReport` / `CreateReportInput` in `lib/api/types.ts`). The
 * wizard renders these steps; the payload it POSTs is this object 1:1 — no
 * field-name translation layer.
 *
 * `meeting_held` (boolean), `currency` (string) and `comment` (free text) are
 * not counters and are handled directly by the wizard, not through this list.
 */

/** Numeric figure fields — every one is a non-negative integer. */
export type FigureKey =
  | "members_present"
  | "guests_cards"
  | "decisions_card"
  | "guest_visitation"
  | "decisions_visitation"
  | "physical_checkup"
  | "phone_checkup"
  | "text_checkup"
  | "email_checkup"
  | "no_of_meeting_held"
  | "total_offering"
  | "holy_ghost_baptism"
  | "communion_service"
  | "community_project"
  | "less_priviledged_visit"
  | "cell_leader_visit"
  | "cell_members_visit"
  | "new_cells"
  | "converts"
  | "guests"
  | "outreach";

export type ReportCategory = "Membership" | "Maturity" | "Ministry" | "Mission" | "Comments";

export interface FigureField {
  key: FigureKey;
  label: string;
  group?: string;
}

export interface ReportStep {
  category: ReportCategory;
  hint: string;
  fields: FigureField[];
}

export const REPORT_STEPS: ReportStep[] = [
  {
    category: "Membership",
    hint: "Attendance, guests and visitation for this Sunday.",
    fields: [
      { key: "members_present", label: "Members Present" },
      //{ key: "no_of_meeting_held", label: "Meetings Held" },
      { key: "guests_cards", label: "Guest Cards Received", group: "Guest / Decision Cards" },
      { key: "decisions_card", label: "Decision Cards Received", group: "Guest / Decision Cards" },
      { key: "guest_visitation", label: "Guests — Total Visitation", group: "Guest / Decision Cards" },
      { key: "decisions_visitation", label: "Decisions — Total Visitation", group: "Guest / Decision Cards" },
      { key: "physical_checkup", label: "Physical Contact", group: "Visitation Among Members" },
      { key: "phone_checkup", label: "Phone", group: "Visitation Among Members" },
      { key: "text_checkup", label: "Text Message", group: "Visitation Among Members" },
      { key: "email_checkup", label: "Email", group: "Visitation Among Members" },
    ],
  },
  {
    category: "Maturity",
    hint: "Giving and spiritual growth.",
    fields: [
      { key: "total_offering", label: "Total Offering", group: "Finance" },
      { key: "holy_ghost_baptism", label: "Baptism in the Holy Ghost", group: "Growth" },
    ],
  },
  {
    category: "Ministry",
    hint: "Service and visitation activity this week.",
    fields: [
      { key: "communion_service", label: "Communion Service Held" },
      { key: "community_project", label: "Community Projects Held" },
      { key: "less_priviledged_visit", label: "Less Privileged Visitation" },
      { key: "cell_leader_visit", label: "Cell Leader Visitation" },
      { key: "cell_members_visit", label: "Cell Member Visitation" },
    ],
  },
  {
    category: "Mission",
    hint: "Growth and outreach.",
    fields: [
      { key: "new_cells", label: "New Cells Birthed" },
      { key: "converts", label: "Converts" },
      { key: "guests", label: "Guests" },
      { key: "outreach", label: "Outreach Programmes" },
    ],
  },
  {
    category: "Comments",
    hint: "Additional comments or feedback (optional).",
    fields: [],
  },
];

export const ALL_FIGURE_KEYS: FigureKey[] = REPORT_STEPS.flatMap((s) => s.fields.map((f) => f.key));

export const FIGURE_LABEL: Record<FigureKey, string> = Object.fromEntries(
  REPORT_STEPS.flatMap((s) => s.fields.map((f) => [f.key, f.label])),
) as Record<FigureKey, string>;

/** Currencies the offering field accepts. */
export const CURRENCY_OPTIONS = ["NGN", "USD", "GBP", "EUR"] as const;
export const DEFAULT_CURRENCY = "NGN";
