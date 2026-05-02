import { AuthGuard } from "@/components/auth/auth-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
