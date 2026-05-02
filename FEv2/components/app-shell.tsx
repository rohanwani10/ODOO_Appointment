"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, user, hasRole, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Home", visible: true },
    { href: "/dashboard", label: "Dashboard", visible: isAuthenticated },
    { href: "/appointments", label: "Appointments", visible: isAuthenticated },
    { href: "/settings", label: "Settings", visible: isAuthenticated },
    {
      href: "/organizer",
      label: "Organizer",
      visible: hasRole("ORGANIZER", "ADMIN"),
    },
    {
      href: "/organizer/services",
      label: "Services",
      visible: hasRole("ORGANIZER", "ADMIN"),
    },
    {
      href: "/organizer/resources",
      label: "Resources",
      visible: hasRole("ORGANIZER", "ADMIN"),
    },
    {
      href: "/organizer/bookings",
      label: "Bookings",
      visible: hasRole("ORGANIZER", "ADMIN"),
    },
    {
      href: "/organizer/reports",
      label: "Reports",
      visible: hasRole("ORGANIZER", "ADMIN"),
    },
    { href: "/admin", label: "Admin", visible: hasRole("ADMIN") },
  ];

  return (
    <div className="layout">
      <header className="header">
        <div>
          <Link href="/" className="brand">
            FEv2
          </Link>
          <p className="subtle">Clean frontend scaffold with RBAC first.</p>
        </div>
        <div className="header-right">
          {user ? <span>{user.first_name} {user.last_name} ({user.roles.join(", ")})</span> : null}
          {isAuthenticated ? (
            <button type="button" onClick={() => void logout()}>
              Logout
            </button>
          ) : (
            <Link href="/auth/login">Login</Link>
          )}
        </div>
      </header>

      <div className="app-grid">
        <aside className="sidebar">
          <nav>
            <ul>
              {navItems
                .filter((item) => item.visible)
                .map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={pathname === item.href ? "active-link" : ""}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </aside>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
