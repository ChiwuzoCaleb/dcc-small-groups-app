import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      subtitle="Region 7"
      roleLabel="Password"
      headline="Forgot your password?"
      blurb="Enter your email and we'll send you a link to choose a new one."
      rightPane={<ForgotPasswordForm />}
    />
  );
}
