"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/appointments", label: "Appointments" },
  { href: "/organizer", label: "Organizer" },
  { href: "/settings", label: "Settings" },
  { href: "/admin", label: "Admin" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { user, isOrganizer, isAdmin, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/auth/login");
  };

  const visibleNavItems = navItems.filter((item) => {
    if (item.href === "/admin") {
      return isAdmin;
    }

    if (item.href === "/organizer") {
      return isOrganizer;
    }

    return true;
  });

  return (
    <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-white"
          >
            Appointment Hub
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-white text-slate-950"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-white leading-none">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="text-[10px] text-white/60 leading-tight">
                {user?.email}
              </span>
            </div>
            <button
              onClick={() => void handleLogout()}
              className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
