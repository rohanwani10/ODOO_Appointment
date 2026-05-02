import Link from "next/link";
import { redirect } from "next/navigation";

type LegacyResetPasswordPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function LegacyResetPasswordPage({
  searchParams,
}: LegacyResetPasswordPageProps) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  if (token) {
    redirect(`/auth/reset-password/${encodeURIComponent(token)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_40%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-4">
      <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-white shadow-2xl shadow-slate-950/30 backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">
          Reset link unavailable
        </h1>
        <p className="mt-3 text-sm text-red-100">
          This reset link is missing its token. Request a new password reset
          email and try again.
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-6 inline-flex rounded-2xl bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-sky-300"
        >
          Request new link
        </Link>
      </div>
    </div>
  );
}
