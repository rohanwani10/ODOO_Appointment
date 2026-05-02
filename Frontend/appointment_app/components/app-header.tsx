"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard" },
];

const organizerNavItems = [
  { href: "/organizer", label: "Workspace" },
  { href: "/organizer/services", label: "Services" },
];

const adminNavItems = [
  { href: "/admin", label: "Admin" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { user, logout, isOrganizer, isAdmin } = useAuth();
  const router = useRouter();
  const navItems = [
    ...baseNavItems,
    ...(isOrganizer ? organizerNavItems : []),
    ...(isAdmin ? adminNavItems : []),
  ];

  const handleLogout = async () => {
    await logout();
    // After logout send users to the public home page
    router.push("/");
  };

  const initials =
    `${user?.first_name?.[0] ?? "C"}${user?.last_name?.[0] ?? ""}`.trim();
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    "Calvero user";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/92 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-950">
              C
            </span>
            Calvero
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-sm font-medium transition-colors",
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

        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-white outline-none transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <span className="flex size-9 items-center justify-center rounded-full bg-sky-400/15 text-sm font-semibold text-sky-100">
              {initials}
            </span>
            <div className="hidden flex-col items-start sm:flex">
              <span className="text-xs font-semibold leading-none text-white">
                {displayName}
              </span>
              <span className="text-[10px] leading-tight text-white/60">
                {user?.email}
              </span>
            </div>
            <ChevronDown className="size-4 text-white/60" />
          </summary>

          <div className="absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-2 shadow-2xl shadow-slate-950/40">
            <div className="border-b border-white/10 px-3 py-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
                  {initials}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {displayName}
                  </p>
                  <p className="text-xs text-white/60">{user?.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1 px-1 py-2">
              <Link
                href="/settings"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Settings2 className="size-4" />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                type="button"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
