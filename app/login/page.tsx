import { LoginForm } from "@/features/auth/components/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = params.next;
  const nextPath = Array.isArray(nextParam) ? nextParam[0] : nextParam;

  return <LoginForm nextPath={nextPath || "/stocks"} />;
}
