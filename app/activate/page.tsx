import { redirect } from "next/navigation";

/** Legacy path — invitation links now open `/activate-account`. */
export default async function ActivateRedirect({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  redirect(value ? `/activate-account?token=${encodeURIComponent(value)}` : "/activate-account");
}
