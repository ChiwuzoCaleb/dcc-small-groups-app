import { AuthShell } from "@/components/auth/AuthShell";
import { SignInForm } from "@/components/auth/SignInForm";

export default function SignInPage() {
  return (
    <AuthShell
      subtitle=""
      roleLabel="Small Groups"
      headline="One place for every cell report in Alimosho."
      blurb="Submit your Sunday report, approve the ones waiting on you, and see how compliance rolls up the whole region — all from one system of record."
      rightPane={<SignInForm />}
    />
  );
}
