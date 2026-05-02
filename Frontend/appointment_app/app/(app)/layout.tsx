import { Sidebar } from "@/components/layout/sidebar";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-dashboard-grid bg-background text-white">
        <Sidebar />
        <div className="flex-1 pl-20">
          <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
