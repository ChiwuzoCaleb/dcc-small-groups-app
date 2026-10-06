"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors } from "@/lib/tokens";
import { TextInput, Button } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api/errors";
import { notify } from "@/lib/toast";

export function SignInForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    try {
      await login(identifier.trim(), password);
      notify.success("Signed in");
      router.replace("/");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.fieldError("email") ??
            err.fieldError("cell_code") ??
            err.fieldError("password") ??
            err.message
          : "Could not sign in. Please try again.";
      setError(msg);
      notify.error(msg);
      setPending(false);
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: 372, margin: "0 auto" }}>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.035em", marginBottom: 7 }}>Sign in</div>
      <div style={{ fontSize: 13.5, color: colors.muted, lineHeight: 1.55, marginBottom: 28 }}>
        Use the email address your coordinator onboarded you with, or your cell code.
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) submit();
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>
              Email
            </span>
            <TextInput value={identifier} onChange={setIdentifier} placeholder="name@email.com" type="text" />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: colors.muted, marginBottom: 7 }}>Password</span>
            <TextInput value={password} onChange={setPassword} type="password" placeholder="••••••••" />
          </label>
        </div>

        {error && (
          <div role="alert" style={{ marginTop: 14, fontSize: 12.5, color: colors.red }}>
            {error}
          </div>
        )}

        <Button variant="primary" fullWidth style={{ marginTop: 24, padding: 15, fontSize: 14.5 }} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div
        style={{
          marginTop: 26,
          padding: "14px 16px",
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          fontSize: 12,
          color: colors.muted,
          lineHeight: 1.55,
        }}
      >
        No password yet? Your account is created by your coordinator&apos;s hierarchy upload. Check your inbox for the
        activation link, or activate below.
      </div>
      <div style={{ marginTop: 22, fontSize: 12, color: colors.faint2, lineHeight: 1.55, textAlign: "center" }}>
        First time here?{" "}
        <a href="/resend-activation" style={{ fontWeight: 600 }}>
          Activate your account
        </a>
      </div>
    </div>
  );
}
