import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ActivateWizard } from "@/components/auth/ActivateWizard";

export default function ActivateAccountPage() {
  return (
    <AuthShell
      subtitle="Alimosho Region"
      roleLabel="Activation"
      headline="Your account already exists — this just turns it on."
      blurb="Accounts are created by your coordinator's hierarchy upload. Choose a password from your invitation link and you're ready to sign in."
      rightPane={
        <Suspense fallback={null}>
          <ActivateWizard />
        </Suspense>
      }
    />
  );
}
