/**
 * POST /api/auth/resend-activation  { email }
 *
 * Unauthenticated. Forwards to the upstream `v1/user/resend-activation-link/`.
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

  const { email } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ detail: "email is required." }, { status: 400 });
  }

  try {
    const result = await httpRequest<{ detail?: string }>(
      upstreamUrl(API_ROUTES.resendActivationLink),
      { method: "POST", body: { email: email.trim() } },
    );
    return NextResponse.json(result ?? {});
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.raw ?? { detail: err.message }, { status: err.status || 400 });
    }
    return NextResponse.json({ detail: "Could not resend the activation email. Please try again." }, { status: 502 });
  }
}
