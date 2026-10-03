"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors } from "@/lib/tokens";
import { TextInput, Button } from "@/components/ui";
import { httpRequest } from "@/lib/api/http";
import { ApiError } from "@/lib/api/errors";

export function ActivateWizard() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function activate() {
    setError(null);
    if (!token) {
      setError("This activation link is missing its token. Use the link from your invitation email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await httpRequest("/api/auth/complete-profile", {
        method: "POST",
        body: { token, password, password_confirmation: confirmPassword },
        fetchOptions: { credentials: "same-origin" },
      });
      setDone(true);
      setTimeout(() => router.replace("/sign-in"), 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.fieldError("password") ??
            err.fieldError("token") ??
            err.fieldError("password_confirmation") ??
            err.message,
        );
      } else {
        setError("Could not activate your account. Please try again.");
      }
      setPending(false);
    }
  }

  if (done) {
    return (
      <div style={{ width: "100%", maxWidth: 400, margin: "0 auto", textAlign: "center" }} role="status">
        <div
          aria-hidden="true"
          style={{ width: 52, height: 52, margin: "0 auto 18px", borderRadius: "50%", background: colors.greenSoft, color: colors.green, display: "grid", placeItems: "center", fontSize: 26, fontWeight: 700 }}
        >
          ✓
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.035em", marginBottom: 7 }}>Account activated</div>
        <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.55, marginBottom: 28 }}>
          Your password is set. Taking you to sign in…
        </div>
        <Button variant="primary" fullWidth style={{ padding: 15, fontSize: 14.5 }} onClick={() => router.replace("/sign-in")}>
          Continue to sign in
        </Button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.035em", marginBottom: 7 }}>Activate your account</div>
      <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.55, marginBottom: 28 }}>
        Choose a password to finish setting up the account your coordinator created for you.
      </div>

      {!token && (
        <div
          role="alert"
          style={{
            marginBottom: 20,
            padding: "12px 14px",
            background: colors.redSoft,
            border: `1px solid ${colors.redSoftBorder}`,
            borderRadius: 10,
            fontSize: 12.5,
            color: colors.red,
            lineHeight: 1.5,
          }}
        >
          Open this page from the link in your invitation email — it carries the token that activates your account.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) activate();
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>New password</span>
            <TextInput value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>Confirm password</span>
            <TextInput value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Re-enter your password" />
          </label>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 14, fontSize: 12.5, color: colors.red }}>
            {error}
          </div>
        )}

        <Button variant="primary" fullWidth style={{ marginTop: 24, padding: 15, fontSize: 14.5 }} disabled={pending || !token}>
          {pending ? "Activating…" : "Activate account"}
        </Button>
      </form>

      <div style={{ marginTop: 22, fontSize: 12, color: colors.faint2, lineHeight: 1.55, textAlign: "center" }}>
        Already activated?{" "}
        <a href="/sign-in" style={{ fontWeight: 600 }}>
          Sign in
        </a>
      </div>
    </div>
  );
}
