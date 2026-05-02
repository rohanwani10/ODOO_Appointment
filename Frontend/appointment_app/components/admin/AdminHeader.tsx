"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { removeTokens } from "@/lib/auth";

export function AdminHeader() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    removeTokens();
    router.push("/auth/login");
  };

  return (
    <header className="border-b border-white/10 bg-slate-900/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/admin"
            className="text-lg font-semibold tracking-tight text-white"
          >
            Admin users
          </Link>
          <p className="text-xs text-white/50">Roles and account controls</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-white">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-white/50">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
