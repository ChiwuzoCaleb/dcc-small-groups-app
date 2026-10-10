import { rnd } from "./tree";
import type { TreeNode } from "./tree";

export const APPROVAL_COMMENTS = [
  "We held the meeting at Sister Bola’s house because of the rain. Two guests came with Brother Segun and both filled guest cards.",
  "Attendance was low this week — three families travelled for a burial in Ogun State. They should be back next Sunday.",
  "No comments.",
  "We started the new study series. One member brought her neighbour, who has asked about baptism.",
  "The cell has grown past 20. I have spoken to my Section Leader about splitting it before the end of the quarter.",
  "Power outage meant we could not do the online arm this week. Physical meeting held as normal.",
];

export interface ReportFigures {
  present: number;
  guestCards: number;
  decisionCards: number;
  guestVisit: number;
  decisionVisit: number;
  vPhysical: number;
  vPhone: number;
  vText: number;
  vEmail: number;
  paidIn: number;
  baptism: number;
  communion: number;
  community: number;
  lessPriv: number;
  clVisit: number;
  cmVisit: number;
  newCells: number;
  converts: number;
  guests: number;
  outreach: number;
}

export function figFor(n: TreeNode): ReportFigures {
  const r = rnd(n.name.length * 331 + n.cells * 17 + 7);
  const g = (max: number) => Math.round(r() * max);
  return {
    present: 9 + g(11),
    guestCards: g(4),
    decisionCards: g(3),
    guestVisit: g(3),
    decisionVisit: g(2),
    vPhysical: g(6),
    vPhone: 2 + g(7),
    vText: g(9),
    vEmail: g(3),
    paidIn: g(12),
    baptism: g(2),
    communion: g(1),
    community: g(1),
    lessPriv: g(2),
    clVisit: g(4),
    cmVisit: g(6),
    newCells: g(1),
    converts: g(3),
    guests: g(4),
    outreach: g(2),
  };
}

export const CF_OVERDUE = [
  { name: "Ifeanyi Nwachukwu", meta: "New Convert · Grace Cell · Boluwatife Sodipo", days: 12 },
  { name: "Samuel Ogunbiyi", meta: "New Convert · Grace Cell · Boluwatife Sodipo", days: 9 },
  { name: "Rukayat Adeleke", meta: "First Timer · Zion Cell · Femi Ogunleye", days: 9 },
  { name: "Paul Ekene", meta: "First Timer · Hebron Cell · Chidi Eze", days: 8 },
  { name: "Toyin Alabi", meta: "New Convert · Bethel Cell · Aisha Balogun", days: 8 },
];

export const CF_LEADERS = [
  { name: "Ngozi Okonkwo", cell: "Faith Cell", assigned: 6, pct: 100 },
  { name: "Aisha Balogun", cell: "Bethel Cell", assigned: 4, pct: 92 },
  { name: "Boluwatife Sodipo", cell: "Grace Cell", assigned: 9, pct: 66 },
  { name: "Femi Ogunleye", cell: "Zion Cell", assigned: 7, pct: 58 },
  { name: "Chidi Eze", cell: "Hebron Cell", assigned: 5, pct: 40 },
  { name: "Halima Yusuf", cell: "Shiloh Cell", assigned: 3, pct: 33 },
];

export const EXPORT_SET_DEFS: { label: string; sub: string }[] = [
  { label: "Compliance summary", sub: "Submitted, pending and missing counts per level" },
  { label: "Report figures", sub: "All 24 fields per cell, per Sunday" },
  { label: "Follow-up outcomes", sub: "Assignments, contact status and days open" },
  { label: "Chronic non-reporters", sub: "Cells that missed 3 or more consecutive Sundays" },
  { label: "Leader directory", sub: "Names, roles, phone numbers and activation status" },
];

export const EXPORT_RECENT = [
  { name: "Region 7 · compliance · Aug 2026", meta: "Generated 24 Aug, 6:10am · 3,214 rows", kind: "CSV" },
  { name: "Ikotun Zone · report figures · Q3", meta: "Generated 21 Aug, 4:52pm · 9,880 rows", kind: "CSV" },
  { name: "Board summary · July 2026", meta: "Generated 01 Aug, 7:00am · 12 pages", kind: "PDF" },
  { name: "Chronic non-reporters · Aug 2026", meta: "Generated 24 Aug, 6:10am · 41 rows", kind: "CSV" },
];

export const HISTORY_BASE = [
  { date: "16 Aug", channel: "WhatsApp · 7:15pm", label: "Approved" },
  { date: "09 Aug", channel: "Web · 8:02pm", label: "Approved" },
  { date: "02 Aug", channel: "Web · 9:31pm", label: "Rejected" },
  { date: "26 Jul", channel: "WhatsApp · 6:58pm", label: "Approved" },
];

export const LEADER_TREND = [12, 15, 11, 16, 13, 17, 14, 16];
export const TREND_DATES = ["05 Jul", "12 Jul", "19 Jul", "26 Jul", "02 Aug", "09 Aug", "16 Aug", "23 Aug"];
