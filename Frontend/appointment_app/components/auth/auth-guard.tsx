"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserRole } from "@/types/user";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { isLoading, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;                 // Still fetching – do nothing yet

    if (!isAuthenticated) {
      router.replace("/auth/login");       // Not logged in → login
      return;
    }

    if (allowedRoles && !allowedRoles.some((role) => hasRole(role))) {
      router.replace("/dashboard");        // Wrong role → dashboard
    }
  }, [isLoading, isAuthenticated, allowedRoles, hasRole, router]);

  // --- Render gates ----
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;  // redirect is in-flight
  }

  if (allowedRoles && !allowedRoles.some((role) => hasRole(role))) {
    return null;  // redirect is in-flight
  }

  return <>{children}</>;
}
