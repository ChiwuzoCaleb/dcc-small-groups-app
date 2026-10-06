"use client";

import { useState } from "react";
import { colors } from "@/lib/tokens";
import { TextInput, Button } from "@/components/ui";
import { httpRequest } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { notify } from "@/lib/toast";

export function ResendActivationForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email address.");
      return;
    }
    setPending(true);
    try {
      const res = await httpRequest<{ detail?: string; message?: string } | null>("/api/auth/resend-activation", {
        method: "POST",
        body: { email: trimmed },
        fetchOptions: { credentials: "same-origin" },
      });
      setSent(true);
      notify.success(res?.detail ?? res?.message ?? "Activation email sent. Check your inbox.");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.fieldError("email") ?? err.message)
          : "Could not resend the activation email. Please try again.";
      setError(message);
      notify.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.035em", marginBottom: 7 }}>Resend activation email</div>
      <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.55, marginBottom: 28 }}>
        Enter the email your coordinator registered for you and we&apos;ll send a fresh activation link.
      </div>

      {sent ? (
        <div
          role="status"
          style={{
            padding: "12px 14px",
            background: colors.greenSoft,
            borderRadius: 10,
            fontSize: 13,
            color: colors.green,
            lineHeight: 1.5,
          }}
        >
          If an inactive account exists for {email.trim()}, an activation link is on its way. Check your inbox.
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) resend();
          }}
        >
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>Email</span>
            <TextInput value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
          </label>

          {error && (
            <div role="alert" style={{ marginTop: 14, fontSize: 12.5, color: colors.red }}>
              {error}
            </div>
          )}

          <Button variant="primary" fullWidth style={{ marginTop: 24, padding: 15, fontSize: 14.5 }} disabled={pending}>
            {pending ? "Sending…" : "Resend"}
          </Button>
        </form>
      )}

      <div style={{ marginTop: 22, fontSize: 12, color: colors.faint2, lineHeight: 1.55, textAlign: "center" }}>
        <a href="/sign-in" style={{ fontWeight: 600 }}>
          Back to sign in
        </a>
      </div>
    </div>
  );
}
