import "server-only";

/**
 * Server-side JWT handling: the access/refresh pair lives in httpOnly cookies
 * that browser JavaScript can never read. A third httpOnly cookie, `dcc_user`,
 * caches the profile object the API returns at login (used for role routing).
 * Everything here runs only in route handlers and server components.
 */

import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  API_ROUTES,
  REFRESH_COOKIE,
  REFRESH_COOKIE_MAX_AGE,
  REMOTE_API_BASE_URL,
  USER_COOKIE,
} from "./config";
import { httpRequest } from "./http";
import { unwrapData } from "./normalize";
import type {
  AccessTokenClaims,
  ApiUser,
  LoginResponse,
  NormalisedLogin,
  TokenPair,
  TokenRefreshResponse,
} from "./types";

export function upstreamUrl(path: string): string {
  return `${REMOTE_API_BASE_URL}/api/${path.replace(/^\/+/, "")}`;
}

const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type CookieSetter = { cookies: { set: (name: string, value: string, opts?: object) => void } };

/** Decode (not verify) a JWT payload. Trusted only because it came from our own httpOnly cookie. */
export function decodeJwt<T = AccessTokenClaims>(token: string): T | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const claims = decodeJwt<AccessTokenClaims>(token);
  if (!claims?.exp) return true;
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}

export async function readTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const store = await cookies();
  return {
    access: store.get(ACCESS_COOKIE)?.value ?? null,
    refresh: store.get(REFRESH_COOKIE)?.value ?? null,
  };
}

export async function readUser(): Promise<ApiUser | null> {
  const raw = (await cookies()).get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiUser;
  } catch {
    return null;
  }
}

/**
 * Write the JWT pair (and optionally the user profile) onto a response's
 * cookies. Pass the `NextResponse` you are about to return.
 */
export function writeTokensOnResponse(
  res: CookieSetter,
  tokens: { access: string; refresh?: string; user?: ApiUser | null },
): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access, { ...cookieBase, maxAge: ACCESS_COOKIE_MAX_AGE });
  if (tokens.refresh) {
    res.cookies.set(REFRESH_COOKIE, tokens.refresh, { ...cookieBase, maxAge: REFRESH_COOKIE_MAX_AGE });
  }
  if (tokens.user) {
    res.cookies.set(USER_COOKIE, JSON.stringify(tokens.user), {
      ...cookieBase,
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
  }
}

export function clearTokensOnResponse(res: CookieSetter): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) {
    res.cookies.set(name, "", { ...cookieBase, maxAge: 0 });
  }
}

/** Same as {@link writeTokensOnResponse} but through the ambient store (Server Actions). */
export async function persistTokens(tokens: {
  access: string;
  refresh?: string;
  user?: ApiUser | null;
}): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.access, { ...cookieBase, maxAge: ACCESS_COOKIE_MAX_AGE });
  if (tokens.refresh) {
    store.set(REFRESH_COOKIE, tokens.refresh, { ...cookieBase, maxAge: REFRESH_COOKIE_MAX_AGE });
  }
  if (tokens.user) {
    store.set(USER_COOKIE, JSON.stringify(tokens.user), { ...cookieBase, maxAge: REFRESH_COOKIE_MAX_AGE });
  }
}

export async function clearTokens(): Promise<void> {
  const store = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) {
    store.set(name, "", { ...cookieBase, maxAge: 0 });
  }
}

// ---------------------------------------------------------------------------
// Upstream auth calls
// ---------------------------------------------------------------------------

/**
 * `POST /api/v1/user/login/` — accepts `email` **or** `cell_code` plus a
 * password; returns `{ message, data: { ...profile, tokens } }`. We normalise
 * it to `{ access, refresh, user }`.
 *
 * `user.role` comes back as the role name directly (e.g. `"SECTION_LEADER"`)
 * — not a UUID needing a lookup against `/api/v1/roles/`, despite what the
 * OpenAPI schema documents. An earlier version of this function resolved it
 * through that endpoint; that lookup never matched anything against the live
 * API (comparing a role name to a list of UUIDs) and has been removed.
 */
export async function loginWithPassword(credentials: {
  email?: string;
  cell_code?: string;
  password: string;
}): Promise<NormalisedLogin> {
  const body = await httpRequest<LoginResponse>(upstreamUrl(API_ROUTES.login), {
    method: "POST",
    body: {
      ...(credentials.email ? { email: credentials.email } : {}),
      ...(credentials.cell_code ? { cell_code: credentials.cell_code } : {}),
      password: credentials.password,
    },
  });

  const data = unwrapData<LoginResponse["data"]>(body);
  const { tokens, ...user } = data ?? ({} as LoginResponse["data"]);
  if (!tokens?.access || !tokens?.refresh) {
    throw new Error("Login response did not include an access/refresh token pair.");
  }

  return { access: tokens.access, refresh: tokens.refresh, user };
}

/** `POST /api/token/` — bare SimpleJWT pair, no profile. */
export function obtainTokens(email: string, password: string): Promise<TokenPair> {
  return httpRequest<TokenPair>(upstreamUrl(API_ROUTES.tokenObtain), {
    method: "POST",
    body: { email, password },
  });
}

/**
 * Trade a refresh token for a new access token (and rotated refresh, when
 * enabled). The backend's API reference marks `/user/refresh/` as requiring
 * `IsAuthenticated` (not `AllowAny`), which is unusual for a refresh endpoint
 * — refresh is normally called *because* the access token has expired. We
 * attach `access` as a bearer token when the caller still has one: thanks to
 * the 30s skew in `isJwtExpired`, a token already flagged "expired" often has
 * a few seconds of real validity left, so this can satisfy the requirement in
 * the common case. It can't help once the access token has been dead for a
 * while — that scenario needs backend confirmation of what this endpoint
 * actually requires.
 */
export function refreshTokens(refresh: string, access?: string | null): Promise<TokenRefreshResponse> {
  // A dashboard load fires many parallel requests. When the refresh token
  // rotates (and the old one is blacklisted), only the first refresh would
  // succeed and the rest would sign the user out. Share one in-flight call per
  // refresh token and keep its result briefly for late arrivals.
  const existing = refreshInFlight.get(refresh);
  if (existing) return existing;

  const pending = httpRequest<TokenRefreshResponse>(upstreamUrl(API_ROUTES.tokenRefresh), {
    method: "POST",
    body: { refresh },
    headers: access ? { Authorization: `Bearer ${access}` } : {},
  });
     refreshInFlight.set(refresh, pending);
     pending.then(
       () => setTimeout(() => refreshInFlight.delete(refresh), 10_000),
       () => refreshInFlight.delete(refresh),
     );
     return pending;
}

const refreshInFlight = new Map<string, Promise<TokenRefreshResponse>>();
