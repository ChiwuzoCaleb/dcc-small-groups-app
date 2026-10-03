/**
 * POST /api/auth/login  { identifier, password }
 *
 * `identifier` is an email address or a cell code (the upstream `v1/user/login/`
 * accepts either). Stores the JWT pair + user profile in httpOnly cookies and
 * responds with the profile only — never the tokens.
 */

import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { loginWithPassword, writeTokensOnResponse } from "@/lib/api/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Expected a JSON body." }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const password = body.password;
  const rawId =
    (typeof body.identifier === "string" && body.identifier) ||
    (typeof body.email === "string" && body.email) ||
    (typeof body.cell_code === "string" && body.cell_code) ||
    "";
  const identifier = rawId.trim();

  if (!identifier || typeof password !== "string" || !password) {
    return NextResponse.json(
      { detail: "An email and a password are required.", code: "invalid_input" },
      { status: 400 },
    );
  }

  const credentials = identifier.includes("@")
    ? { email: identifier, password }
    : { cell_code: identifier, password };

  try {
    const { access, refresh, user } = await loginWithPassword(credentials);
    const res = NextResponse.json({ authenticated: true, user });
    writeTokensOnResponse(res, { access, refresh, user });
    return res;
  } catch (err) {
    if (err instanceof ApiError) {
      // Forward the upstream DRF body verbatim so the client can map field errors.
      const body = err.raw ?? { detail: err.message, code: err.code };
      return NextResponse.json(body, { status: err.status || 400 });
    }
    return NextResponse.json(
      { detail: "Could not sign in right now. Please try again." },
      { status: 502 },
    );
  }
}
