/**
 * Backend-for-frontend proxy.
 *
 * Every browser API call goes here: `/api/proxy/v1/reports/?page=2` is
 * forwarded to `${DCC_API_BASE_URL}/api/v1/reports/?page=2` with the JWT from
 * the httpOnly `dcc_access` cookie attached as a bearer token. The browser
 * never sees the token and never talks to Render directly, so there is no
 * CORS surface and no XSS-readable credential.
 *
 * On an expired / rejected access token the proxy transparently refreshes once
 * using the `dcc_refresh` cookie, retries, and re-issues both cookies.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api/config";
import { ApiError } from "@/lib/api/errors";
import {
  clearTokensOnResponse,
  decodeJwt,
  isJwtExpired,
  refreshTokens,
  upstreamUrl,
  writeTokensOnResponse,
} from "@/lib/api/tokens";

export const dynamic = "force-dynamic";

/** Request headers we never forward upstream. */
const STRIP_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "cookie",
  "content-length",
  "accept-encoding",
  "x-forwarded-host",
  "x-forwarded-port",
]);

/** Response headers we never copy back to the browser. */
const STRIP_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

function unauthorized(message: string, code?: string) {
  const response = NextResponse.json({ detail: message, ...(code ? { code } : {}) }, { status: 401 });
  clearTokensOnResponse(response);
  return response;
}

function badGateway(err: unknown) {
  const message =
    err instanceof ApiError ? err.message : "The API is unreachable right now. Please try again shortly.";
  const status = err instanceof ApiError && err.status >= 400 ? err.status : 502;
  return NextResponse.json({ detail: message, code: "upstream_unreachable" }, { status });
}

function buildUpstreamPath(segments: string[], search: string): string {
  // DRF requires a trailing slash; the catch-all drops it from the segments.
  const joined = segments.map(encodeURIComponent).join("/");
  const withSlash = joined.endsWith("/") ? joined : `${joined}/`;
  return `${withSlash}${search}`;
}

function forwardRequestHeaders(req: NextRequest, access: string): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("Authorization", `Bearer ${access}`);
  return headers;
}

function buildClientResponse(upstream: Response, body: ArrayBuffer): NextResponse {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return new NextResponse(body, { status: upstream.status, headers });
}

type ProxyContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: ProxyContext): Promise<NextResponse> {
  const { path } = await ctx.params;
  if (!path || path.length === 0) {
    return NextResponse.json({ detail: "No API path given." }, { status: 400 });
  }

  let access = req.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value ?? null;

  if (!access && !refresh) {
    return unauthorized("Authentication credentials were not provided.");
  }

  // Buffer the body once so we can replay it on a post-refresh retry.
  const method = req.method.toUpperCase();
  const rawBody =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const target = upstreamUrl(buildUpstreamPath(path, req.nextUrl.search));

  let rotated: { access: string; refresh?: string } | null = null;

  // Proactive refresh when the access token is missing or already expired.
  if ((!access || isJwtExpired(access)) && refresh) {
    try {
      const next = await refreshTokens(refresh, access);
      access = next.access;
      rotated = { access: next.access, refresh: next.refresh };
    } catch (err) {
      const res = unauthorized(
        "Your session has expired. Please sign in again.",
        "token_not_valid",
      );
      // Best effort: clear the dead cookies.
      res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
      return err instanceof ApiError && err.status >= 500 ? badGateway(err) : res;
    }
  }

  if (!access) return unauthorized("Authentication credentials were not provided.");

  const doFetch = (token: string) =>
    fetch(target, {
      method,
      headers: forwardRequestHeaders(req, token),
      body: rawBody ? Buffer.from(rawBody) : undefined,
      redirect: "manual",
      cache: "no-store",
    });

  let upstream: Response;
  try {
    upstream = await doFetch(access);
  } catch (err) {
    return badGateway(err);
  }

  // Reactive refresh: the upstream rejected the token we sent.
  if (upstream.status === 401 && refresh && !rotated) {
    try {
      const next = await refreshTokens(refresh, access);
      rotated = { access: next.access, refresh: next.refresh };
      upstream = await doFetch(next.access);
    } catch {
      const res = unauthorized(
        "Your session has expired. Please sign in again.",
        "token_not_valid",
      );
      res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
      res.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  const body = await upstream.arrayBuffer();
  const res = buildClientResponse(upstream, body);
  if (upstream.status === 401) {
    clearTokensOnResponse(res);
  } else if (rotated && decodeJwt(rotated.access)) {
    writeTokensOnResponse(res, rotated);
  }
  return res;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
