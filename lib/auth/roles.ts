/**
 * The role model, mapped 1:1 onto the nine roles the API exposes at
 * `GET /api/v1/roles/` (`UserRole.name`).
 *
 * ⚠️  These strings are CASE-SENSITIVE. They are compared with `===` / Set
 * membership only — never lowercased, trimmed, or substring-matched. The API
 * sends them exactly as written here ("CELL_LEADER", not "cell_leader").
 *
 * Nothing here is server-only: `resolveRole` takes plain data so both the
 * server session layer and client code can use it.
 */

export const ROLE_NAMES = [
  "SUPER_ADMIN",
  "MINISTRY_LEADER",
  "MSU",
  "REGION_LEADER",
  "DISTRICT_LEADER",
  "ZONE_LEADER",
  "AREA_LEADER",
  "SECTION_LEADER",
  "CELL_LEADER",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

const ROLE_NAME_SET: ReadonlySet<string> = new Set(ROLE_NAMES);

/** Exact, case-sensitive check that a value is one of the nine role names. */
export function isRoleName(value: unknown): value is RoleName {
  return typeof value === "string" && ROLE_NAME_SET.has(value);
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/** The four authenticated app surfaces. Each is its own route group. */
export type AppArea = "cell" | "coordinator" | "msu" | "admin";

/** Hierarchy level a role's dashboards are scoped to (mirrors `OrgUnitType`, plus "all"). */
export type ScopeType = "cell" | "section" | "area" | "zone" | "district" | "region" | "all";

/** How a role sits in the report approval workflow (PRD §7.3 / FR-3.2). */
export type ApproverKind = "primary" | "fallback" | "none";

export interface RoleCapabilities {
  /** Route group this role lives in. */
  area: AppArea;
  /** Where "/" and post-sign-in send this role. */
  home: string;
  /** Hierarchy level the role's roll-up dashboards start from. */
  scopeType: ScopeType;
  /** Section = primary approver; Area/Zone/District/Region = fallback; everyone else = none. */
  approverKind: ApproverKind;
  /** Convenience: `approverKind !== "none"`. */
  canApprove: boolean;
  /** Cell leaders always; Area/Zone submit on behalf of a cell (PRD §5.5). */
  canSubmitReports: boolean;
  /** Compliance / follow-up CSV + PDF export (PRD FR-4.5). */
  canExport: boolean;
  /** View-only at their level — District, Region, Ministry (PRD §7.8). */
  readOnly: boolean;
  /** Fallback sidebar label when the API doesn't send `role_name`. */
  label: string;
}

const AREA_HOME: Record<AppArea, string> = {
  cell: "/cell",
  coordinator: "/coordinator",
  msu: "/msu",
  admin: "/admin",
};

/** Root path of each app area — used for route guards and active-nav detection. */
export const AREA_ROOTS: Record<AppArea, string> = { ...AREA_HOME };

function coordinator(
  scopeType: ScopeType,
  approverKind: ApproverKind,
  extra: Partial<RoleCapabilities> & { label: string },
): RoleCapabilities {
  return {
    area: "coordinator",
    home: AREA_HOME.coordinator,
    scopeType,
    approverKind,
    canApprove: approverKind !== "none",
    canSubmitReports: approverKind === "fallback", // Area / Zone only
    canExport: true,
    readOnly: false,
    ...extra,
  };
}

export const CAPABILITIES: Record<RoleName, RoleCapabilities> = {
  SUPER_ADMIN: {
    area: "admin",
    home: AREA_HOME.admin,
    scopeType: "all",
    approverKind: "none",
    canApprove: false,
    canSubmitReports: false,
    canExport: true,
    readOnly: false,
    label: "Super Admin",
  },
  MINISTRY_LEADER: coordinator("all", "none", {
    scopeType: "all",
    readOnly: true,
    label: "Ministry Leadership",
  }),
  MSU: {
    area: "msu",
    home: AREA_HOME.msu,
    scopeType: "all",
    approverKind: "none",
    canApprove: false,
    canSubmitReports: false,
    canExport: true,
    readOnly: false,
    label: "MSU Team",
  },
  REGION_LEADER: coordinator("region", "fallback", {
    canSubmitReports: false,
    label: "Regional Coordinator",
  }),
  DISTRICT_LEADER: coordinator("district", "fallback", {
    canSubmitReports: false,
    label: "District Coordinator",
  }),
  ZONE_LEADER: coordinator("zone", "fallback", { label: "Zonal Coordinator" }),
  AREA_LEADER: coordinator("area", "fallback", { label: "Area Coordinator" }),
  SECTION_LEADER: coordinator("section", "primary", { label: "Section Leader" }),
  CELL_LEADER: {
    area: "cell",
    home: AREA_HOME.cell,
    scopeType: "cell",
    approverKind: "none",
    canApprove: false,
    canSubmitReports: true,
    canExport: false,
    readOnly: false,
    label: "Cell Leader",
  },
};

export function capabilitiesFor(role: RoleName): RoleCapabilities {
  return CAPABILITIES[role];
}

export function homePathForRole(role: RoleName): string {
  return CAPABILITIES[role].home;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface RoleResolutionInput {
  /** The API's `is_superuser` flag on the user profile. */
  isSuperuser?: boolean | null;
  /**
   * `user.role` from the login/session profile — the API sends this as the
   * exact role name already (e.g. `"SECTION_LEADER"`), not a UUID needing a
   * lookup against `/api/v1/roles/`. (An earlier version of this resolver
   * assumed the UUID shape the OpenAPI schema documents; the live API does
   * not behave that way, so nothing looks it up any more.)
   */
  roleName?: unknown;
  /** Decoded access-token claims, if any role hint rides along there. */
  claims?: Record<string, unknown> | null;
}

/** Claim keys that have been seen to carry a role string, in priority order. */
const CLAIM_KEYS = ["role", "role_name", "user_role", "roles", "groups", "scope"] as const;

/**
 * Resolve a session to exactly one {@link RoleName}.
 *
 * 1. `is_superuser` → SUPER_ADMIN.
 * 2. An exact, case-sensitive match of `user.role` against the nine.
 * 3. An exact match of any known JWT claim (string or array of strings).
 * 4. Otherwise CELL_LEADER — the overwhelming majority.
 */
export function resolveRole(input: RoleResolutionInput): RoleName {
  if (input.isSuperuser === true) return "SUPER_ADMIN";

  if (isRoleName(input.roleName)) return input.roleName;

  const claims = input.claims;
  if (claims) {
    for (const key of CLAIM_KEYS) {
      const value = claims[key];
      if (isRoleName(value)) return value;
      if (Array.isArray(value)) {
        const hit = value.find(isRoleName);
        if (hit) return hit;
      }
    }
  }

  return "CELL_LEADER";
}
