/**
 * POST /api/auth/password-reset/confirm  { token, uidb64, password, password_confirmation }
 *
 * Unauthenticated. Forwards to the upstream `v1/user/password-reset/confirm/`.
 */

import { NextResponse } from "next/server";
import { API_ROUTES } from "@/lib/api/config";
import { ApiError } from "@/lib/api/errors";
import { httpRequest } from "@/lib/api/http";
import { upstreamUrl } from "@/lib/api/tokens";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Expected a JSON body." }, { status: 400 });
  }

  const { token, uidb64, password, password_confirmation } = (body ?? {}) as Record<string, unknown>;
  if (
    typeof token !== "string" ||
    typeof uidb64 !== "string" ||
    typeof password !== "string" ||
    typeof password_confirmation !== "string" ||
    !token ||
    !uidb64 ||
    !password
  ) {
    return NextResponse.json(
      { detail: "token, uidb64, password and password_confirmation are required." },
      { status: 400 },
    );
  }

  try {
    const result = await httpRequest<{ detail?: string }>(upstreamUrl(API_ROUTES.passwordResetConfirm), {
      method: "POST",
      body: { token, uidb64, password, password_confirmation },
    });
    return NextResponse.json(result ?? {});
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.raw ?? { detail: err.message }, { status: err.status || 400 });
    }
    return NextResponse.json({ detail: "Could not reset the password. Please try again." }, { status: 502 });
  }
}
