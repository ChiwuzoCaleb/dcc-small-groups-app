/**
 * Central configuration for talking to the remote DCC API
 * (Django REST Framework + SimpleJWT, hosted on Render).
 *
 * Two base URLs are in play:
 *
 *  - `REMOTE_API_BASE_URL` — the real upstream. Only ever read on the server
 *    (route handlers / server components). Never shipped to the browser, so
 *    the JWT and the upstream origin stay server-side and CORS never applies.
 *
 *  - `PROXY_BASE_PATH` — the same-origin path the browser talks to. Every
 *    client request goes here; the BFF proxy in `app/api/proxy` attaches the
 *    bearer token from an httpOnly cookie and forwards upstream.
 *
 * Path literals mirror `MISC/dcc-api-schema.json` ("Daystar Christian Centre
 * App API" v1.0.0). Keep every upstream path in `API_ROUTES`.
 */

/** Upstream API origin. Server-only — do not import this into a client component. */
export const REMOTE_API_BASE_URL = (
  process.env.DCC_API_BASE_URL ?? "https://dcc-api.onrender.com"
).replace(/\/+$/, "");

/** Same-origin prefix the browser uses. `/api/proxy/v1/reports/` → `${REMOTE}/api/v1/reports/`. */
export const PROXY_BASE_PATH = "/api/proxy";

/** Cookie names. The JWT pair is httpOnly; `dcc_user` carries the profile the API returns at login. */
export const ACCESS_COOKIE = "dcc_access";
export const REFRESH_COOKIE = "dcc_refresh";
export const USER_COOKIE = "dcc_user";

/** Cookie `maxAge` ceilings (seconds). SimpleJWT's own lifetimes are shorter and authoritative. */
export const ACCESS_COOKIE_MAX_AGE = 60 * 60; // 1h
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14d

/** Default per-request timeout (ms). Render's free tier cold-starts, so keep this generous. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Upstream paths, relative to `${REMOTE_API_BASE_URL}/api/`. */
export const API_ROUTES = {
  // --- auth -------------------------------------------------------------
  /** SimpleJWT pair from raw credentials. */
  tokenObtain: "token/",
  /** SimpleJWT access (+ rotated refresh) from a refresh token. */
  tokenRefresh: "token/refresh/",
  /** Richer login: returns the JWT pair *and* the user profile object. Preferred. */
  login: "v1/user/login/",
  /** Blacklists a refresh token. */
  logout: "v1/user/logout/",
  /** Access token from a refresh token (v1 alias of tokenRefresh). */
  userRefresh: "v1/user/refresh/",
  /** Admin: invite a leader onto a hierarchy unit. */
  invite: "v1/user/invite/",
  /** Finish onboarding from a magic-link token: set password + profile. */
  completeProfile: "v1/user/complete-profile/",
  /** Resend the activation email for an account that has not been activated. */
  resendActivationLink: "v1/user/resend-activation-link/",
  passwordReset: "v1/user/password-reset/",
  passwordResetConfirm: "v1/user/password-reset/confirm/",

  // --- reports --------------------------------------------------------
  reports: "v1/reports/",
  report: (id: string) => `v1/reports/${id}/`,
  reportApprove: (id: string) => `v1/reports/${id}/approve/`,
  reportReject: (id: string) => `v1/reports/${id}/reject/`,
  myReports: "v1/reports/mine/",
  reportsExport: "v1/reports/export/",
  /** Submit on behalf of a cell identified by `cell_code` (WhatsApp channel). */
  reportWhatsapp: "v1/reports/whatsapp/",

  // --- approvals -----------------------------------------------------
  approvalsQueue: "v1/approvals/queue/",
  /** GET / PATCH the global fallback-approval interval (seconds). */
  approvalSettings: "v1/approval-settings/",

  // --- organisation dashboards ------------------------------------
  orgDashboard: "v1/organization/dashboard/",
  orgDashboardUnit: (unitType: string, id: string) =>
    `v1/organization/dashboard/${unitType}/${id}/`,
  orgDashboardApprovals: "v1/organization/dashboard/approvals/",
  orgDashboardExport: "v1/organization/dashboard/export/",
  orgDashboardNonSubmitters: "v1/organization/dashboard/non-submitters/",
  orgDashboardTrends: "v1/organization/dashboard/trends/",

  // --- roles (read-only in the current API) ------------------------
  roles: "v1/roles/",
} as const;
