import { AdminHeader } from "@/components/admin/AdminHeader";
import { AuthGuard } from "@/components/auth/auth-guard";

function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,rgba(234,179,8,0.08),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] text-white">
        <AdminHeader />
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </AuthGuard>
  );
}

export default AdminLayout;
