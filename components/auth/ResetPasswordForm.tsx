"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors } from "@/lib/tokens";
import { TextInput, Button } from "@/components/ui";
import { httpRequest } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";
import { notify } from "@/lib/toast";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const uidb64 = params.get("uidb64") ?? params.get("uid") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const linkInvalid = !token || !uidb64;

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await httpRequest("/api/auth/password-reset/confirm", {
        method: "POST",
        body: { token, uidb64, password, password_confirmation: confirm },
        fetchOptions: { credentials: "same-origin" },
      });
      setDone(true);
      notify.success("Password updated. Sign in with your new password.");
      setTimeout(() => router.replace("/sign-in"), 2000);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.fieldError("password") ??
            err.fieldError("password_confirmation") ??
            err.fieldError("token") ??
            err.fieldError("uidb64") ??
            err.message)
          : "Could not reset your password. Please try again.";
      setError(message);
      notify.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.035em", marginBottom: 7 }}>Reset password</div>
      <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.55, marginBottom: 28 }}>
        Choose a new password for your account.
      </div>

      {linkInvalid ? (
        <div role="alert" style={{ fontSize: 13, color: colors.red, lineHeight: 1.5 }}>
          This reset link is invalid or incomplete.{" "}
          <a href="/forgot-password" style={{ fontWeight: 600 }}>
            Request a new one
          </a>
          .
        </div>
      ) : done ? (
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
          Your password has been reset. Redirecting to sign in…
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) submit();
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>
                New password
              </span>
              <TextInput value={password} onChange={setPassword} type="password" placeholder="••••••••" />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>
                Confirm password
              </span>
              <TextInput value={confirm} onChange={setConfirm} type="password" placeholder="••••••••" />
            </label>
          </div>

          {error && (
            <div role="alert" style={{ marginTop: 14, fontSize: 12.5, color: colors.red }}>
              {error}
            </div>
          )}

          <Button variant="primary" fullWidth style={{ marginTop: 24, padding: 15, fontSize: 14.5 }} disabled={pending}>
            {pending ? "Saving…" : "Reset password"}
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
