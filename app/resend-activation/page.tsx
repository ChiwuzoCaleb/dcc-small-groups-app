import { AuthShell } from "@/components/auth/AuthShell";
import { ResendActivationForm } from "@/components/auth/ResendActivationForm";

export default function ResendActivationPage() {
  return (
    <AuthShell
      subtitle="Region 7"
      roleLabel="Activation"
      headline="Need a new activation link?"
      blurb="Enter your email and we'll send you a fresh link to activate your account."
      rightPane={<ResendActivationForm />}
    />
  );
}
