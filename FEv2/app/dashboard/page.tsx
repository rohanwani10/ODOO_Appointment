"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const { user, hasRole } = useAuth();

  return (
    <RequireAuth>
      <div className="page">
        <section className="panel">
          <h1>Dashboard</h1>
          <p>
            Signed in as {user?.first_name} {user?.last_name}.
          </p>
          <p>RBAC routes are enabled from the start.</p>
        </section>

        <section className="panel">
          <h2>Available flows</h2>
          <div className="row">
            <Link href="/appointments">Appointments</Link>
            {hasRole("ORGANIZER", "ADMIN") ? <Link href="/organizer">Organizer workspace</Link> : null}
            {hasRole("ORGANIZER", "ADMIN") ? <Link href="/organizer/services">Services</Link> : null}
            {hasRole("ORGANIZER", "ADMIN") ? <Link href="/organizer/resources">Resources</Link> : null}
            {hasRole("ADMIN") ? <Link href="/admin">Admin</Link> : null}
          </div>
        </section>
      </div>
    </RequireAuth>
  );
}
