import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      subtitle="Region 7"
      roleLabel="Password"
      headline="Choose a new password."
      blurb="Pick a new password for your account, then sign in."
      rightPane={
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      }
    />
  );
}
